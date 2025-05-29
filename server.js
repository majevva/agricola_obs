const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const OBSWebSocket = require('obs-websocket-js').default;
const multer = require('multer');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const { exec } = require('child_process');

const app = express();
let config = {}; // Zainicjalizuj pustym obiektem, zostanie załadowany później

try {
    const configPath = path.join(__dirname, 'config.json');
    let configRaw = fsSync.readFileSync(configPath, 'utf8');
    if (configRaw.charCodeAt(0) === 0xFEFF) { // Usuń BOM
      configRaw = configRaw.slice(1);
    }
    config = JSON.parse(configRaw);
} catch (err) {
    console.error(chalk.bgRed.white(' FATAL ERROR ') + ' Nie można wczytać pliku config.json:', err);
    process.exit(1); // Zatrzymaj aplikację, jeśli config jest niezbędny
}

const port = config.port || 3000; // Użyj portu z configu lub domyślnego

// Cache dla danych zawodników
let playersCache = null;
let playersCacheTime = 0;
const CACHE_DURATION = 300000; // 5 minut

// Pobierz lokalny adres IP
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Inicjalizacja konfiguracji (aktualizacja hosta OBS)
function initializeConfig() {
  const configPath = path.join(__dirname, 'config.json');
  try {
    const localIp = getLocalIp();
    // Upewnij się, że config.obs istnieje przed próbą dostępu do config.obs.host
    if (config.obs && config.obs.host !== localIp) {
      const updatedConfig = { ...config, obs: { ...config.obs, host: localIp } };
      fsSync.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 4), 'utf8');
      log.system(`Zaktualizowano obs.host w config.json na ${localIp}`);
      return updatedConfig; // Zwróć zaktualizowany config
    }
    return config; // Zwróć oryginalny config, jeśli nie było zmian
  } catch (err) {
    // log nie jest jeszcze zdefiniowany tutaj, więc użyj console.error
    console.error(chalk.bgRed.white(' ERROR ') + ' Błąd aktualizacji config.json: ' + err.message);
    return config; 
  }
}

const finalConfig = initializeConfig(); // Użyj finalConfig w reszcie kodu

// Logowanie
const log = {
  system: (message) => console.log(chalk.bgBlue.white(' SYSTEM ') + ' ' + message),
  obs: (message) => console.log(chalk.bgMagenta.white(' OBS ') + ' ' + message),
  timer: (message) => console.log(chalk.bgYellow.black(' TIMER ') + ' ' + message),
  error: (message) => console.log(chalk.bgRed.white(' ERROR ') + ' ' + message),
  success: (message) => console.log(chalk.bgGreen.black(' SUCCESS ') + ' ' + message),
  info: (message) => console.log(chalk.bgCyan.black(' INFO ') + ' ' + message),
  stream: (message) => console.log(chalk.bgGreen.white(' STREAM ') + ' ' + message),
  file: (message) => console.log(chalk.bgWhite.black(' FILE ') + ' ' + message)
};

const obs = new OBSWebSocket();

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));

// Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public', 'images');
        if (!fsSync.existsSync(uploadPath)) {
            fsSync.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); 
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'image/svg+xml') {
        cb(null, true);
    } else {
        cb(new Error('Nieprawidłowy typ pliku! Tylko PNG, JPG, SVG są dozwolone.'), false);
    }
};
const upload = multer({ storage: storage, limits: { fileSize: 1024 * 1024 * 2 }, fileFilter: fileFilter });

// Bezpieczne odczytywanie wartości z konfiguracji
const safeGetConfig = (path, defaultValue) => {
    const keys = path.split('.');
    let current = finalConfig;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    return current;
};


// Stan aplikacji
const appState = {
  scorebug: {
    homeName: safeGetConfig('teams.defaultHomeName', 'AGR'), 
    awayName: safeGetConfig('teams.defaultAwayName', 'LSN'), 
    homeScore: 0, awayScore: 0,
    minute: '00', second: '00',
    homeColor: safeGetConfig('colors.home', '#C8102E'), 
    awayColor: safeGetConfig('colors.away', '#1B449C'), 
    teamBackground: safeGetConfig('colors.teamBackground', '#34003a'),
    goalsBackground: safeGetConfig('colors.goalsBackground', '#00fc8a'), 
    timeBackground: safeGetConfig('colors.timeBackground', '#ffffff'),
    teamTextColor: safeGetConfig('colors.teamText', '#ffffff'), 
    goalsTextColor: safeGetConfig('colors.goalsText', '#34003a'), 
    timeTextColor: safeGetConfig('colors.timeText', '#34003a')
  },
  timer: { running: false, seconds: 0, interval: null },
  notification: null,
  obs: { 
    connected: false, 
    reconnecting: false, 
    streamActive: false,
    micMuted: true, 
    selectedMicName: safeGetConfig('obs.defaultMicName', 'Mikrofon')
  },
  introSettings: {
    introHomeTeamFullName: 'Domyślni Gospodarze Pełna Nazwa',
    introAwayTeamFullName: 'Domyślni Goście Pełna Nazwa',
    introMatchDate: '', introMatchTime: '', introMatchLocation: 'Domyślne Miejsce',
    homeLogoPath: '/images/agricola_logo.png', awayLogoPath: '/images/opponent_logo.png'
  }
};

const INTRO_SETTINGS_FILE_PATH = path.join(__dirname, 'intro_settings.json');

async function saveIntroSettingsToFile() {
    try {
        await fs.writeFile(INTRO_SETTINGS_FILE_PATH, JSON.stringify(appState.introSettings, null, 2), 'utf8');
        log.file('Ustawienia Intro zapisane do pliku.');
    } catch (err) {
        log.error("Błąd zapisu ustawień intro do pliku: " + err.message);
    }
}

async function loadIntroSettingsFromFile() {
    try {
        if (fsSync.existsSync(INTRO_SETTINGS_FILE_PATH)) {
            const data = await fs.readFile(INTRO_SETTINGS_FILE_PATH, 'utf8');
            const loadedSettings = JSON.parse(data);
            appState.introSettings = { ...appState.introSettings, ...loadedSettings };

            const defaultHomeLogo = '/images/agricola_logo.png';
            const defaultOpponentLogo = '/images/opponent_logo.png';

            if (!appState.introSettings.homeLogoPath || !fsSync.existsSync(path.join(__dirname, 'public', appState.introSettings.homeLogoPath))) {
                 if(fsSync.existsSync(path.join(__dirname, 'public', defaultHomeLogo))) {
                    appState.introSettings.homeLogoPath = defaultHomeLogo;
                 } else {
                    appState.introSettings.homeLogoPath = ''; 
                 }
            }
            if (!appState.introSettings.awayLogoPath || !fsSync.existsSync(path.join(__dirname, 'public', appState.introSettings.awayLogoPath))) {
                if(fsSync.existsSync(path.join(__dirname, 'public', defaultOpponentLogo))) {
                    appState.introSettings.awayLogoPath = defaultOpponentLogo;
                } else {
                    appState.introSettings.awayLogoPath = '';
                }
            }
            log.file('Ustawienia Intro załadowane z pliku.');
        } else {
            log.file('Plik intro_settings.json nie istnieje, używam domyślnych wartości i tworzę plik.');
            if (!fsSync.existsSync(path.join(__dirname, 'public', appState.introSettings.homeLogoPath))) appState.introSettings.homeLogoPath = '';
            if (!fsSync.existsSync(path.join(__dirname, 'public', appState.introSettings.awayLogoPath))) appState.introSettings.awayLogoPath = '';
            await saveIntroSettingsToFile(); 
        }
    } catch (err) {
        log.error("Błąd odczytu/parsowania ustawień intro z pliku: " + err.message + ". Używam domyślnych.");
        appState.introSettings = {
            introHomeTeamFullName: 'Domyślni Gospodarze Pełna Nazwa',
            introAwayTeamFullName: 'Domyślni Goście Pełna Nazwa',
            introMatchDate: '', introMatchTime: '', introMatchLocation: 'Domyślne Miejsce',
            homeLogoPath: fsSync.existsSync(path.join(__dirname, 'public', '/images/agricola_logo.png')) ? '/images/agricola_logo.png' : '',
            awayLogoPath: fsSync.existsSync(path.join(__dirname, 'public', '/images/opponent_logo.png')) ? '/images/opponent_logo.png' : ''
        };
        await saveIntroSettingsToFile(); 
    }
}


console.clear();
log.system('Inicjalizacja serwera...');

function pad(number) { 
    if (number === null || typeof number === 'undefined') return '00'; // Zabezpieczenie
    return number.toString().padStart(2, '0'); 
}

function updateTimerDisplay() {
  const minutes = Math.floor(appState.timer.seconds / 60);
  const secs = appState.timer.seconds % 60;
  appState.scorebug.minute = pad(minutes);
  appState.scorebug.second = pad(secs);
}

function startServerTimer() {
  if (!appState.timer.running) {
    appState.timer.running = true;
    appState.timer.interval = setInterval(() => {
      appState.timer.seconds++;
      updateTimerDisplay();
    }, 1000);
    log.timer('Timer uruchomiony');
  }
}
function stopServerTimer() {
  if (appState.timer.running) {
    appState.timer.running = false;
    if (appState.timer.interval) {
      clearInterval(appState.timer.interval);
      appState.timer.interval = null;
    }
    log.timer('Timer zatrzymany');
  }
}
function resetServerTimer() {
  stopServerTimer();
  appState.timer.seconds = 0;
  updateTimerDisplay(); 
  log.timer('Timer zresetowany');
}

async function connectToOBS() {
  if (appState.obs.reconnecting || obs.socket) return;
  appState.obs.reconnecting = true;
  log.info(`Próba połączenia z OBS: ws://${finalConfig.obs.host}:${finalConfig.obs.port}`);
  try {
    await obs.connect(`ws://${finalConfig.obs.host}:${finalConfig.obs.port}`, finalConfig.obs.password);
    appState.obs.connected = true;
    appState.obs.reconnecting = false;
    log.success(`Połączono z OBS WebSocket na ${finalConfig.obs.host}:${finalConfig.obs.port}`);
    
    try {
        const streamStatus = await obs.call('GetStreamStatus');
        appState.obs.streamActive = streamStatus.outputActive;
    } catch (e) { log.error(`Błąd pobierania statusu streamu: ${e.message}`); }
    
    try {
        const micName = appState.obs.selectedMicName;
        if (micName) { 
            const micStatus = await obs.call('GetInputMute', { inputName: micName });
            appState.obs.micMuted = micStatus.inputMuted;
        } else {
            log.warn('Nie zdefiniowano nazwy mikrofonu (appState.obs.selectedMicName) do sprawdzenia stanu.');
        }
    } catch (e) { log.error(`Błąd pobierania stanu mikrofonu (${appState.obs.selectedMicName}): ${e.message}. Upewnij się, że źródło o tej nazwie istnieje w OBS.`); }

    obs.on('StreamStateChanged', (data) => {
        log.stream(data.outputActive ? 'Stream rozpoczęty (event)' : 'Stream zakończony (event)');
        appState.obs.streamActive = data.outputActive;
    });
    obs.on('InputMuteStateChanged', (data) => {
        if (data.inputName === appState.obs.selectedMicName) {
            appState.obs.micMuted = data.inputMuted;
            log.obs(`Stan mikrofonu ${data.inputName} zmieniony na: ${data.inputMuted ? 'wyciszony' : 'aktywny'}`);
        }
    });
    obs.on('ConnectionClosed', () => {
      appState.obs.connected = false;
      appState.obs.streamActive = false; 
      appState.obs.micMuted = true; 
      log.error('Połączenie z OBS zostało zamknięte. Próba ponownego połączenia za 5s...');
      setTimeout(() => { appState.obs.reconnecting = false; connectToOBS(); }, 5000);
    });
  } catch (error) {
    appState.obs.connected = false;
    appState.obs.reconnecting = false;
    log.error(`Błąd połączenia z OBS: ${error.message}. Ponowna próba za 10s...`);
    setTimeout(connectToOBS, 10000);
  }
}

function requireOBSConnection(req, res, next) {
  if (!appState.obs.connected) {
    return res.status(503).json({ 
        error: 'Brak połączenia z OBS', 
        message: 'Serwer panelu nie jest połączony z OBS WebSocket.',
        obsConnected: false 
    });
  }
  next();
}

// API Endpoints
app.get('/scorebug-data', (req, res) => res.json(appState.scorebug));
app.get('/notification-data', (req, res) => res.json(appState.notification || {}));
app.get('/initial-settings', (req, res) => res.json(appState.scorebug)); 
app.get('/players-data', async (req, res) => {
    try {
        const now = Date.now();
        if (playersCache && (now - playersCacheTime) < CACHE_DURATION) {
          log.info('Zwrócono dane zawodników z cache');
          return res.json(playersCache);
        }
        
        const homePlayersPath = safeGetConfig('teams.home', 'json/default_home_players.json');
        const awayPlayersPath = safeGetConfig('teams.away', 'json/default_away_players.json');

        log.info(`Ładowanie pliku zawodników gospodarzy: ${homePlayersPath}`);
        const homePlayersRaw = await fs.readFile(path.join(__dirname, 'public', homePlayersPath), 'utf8')
            .catch(err => { log.error(`Nie można wczytać ${homePlayersPath}: ${err.message}`); return '[]'; });
        log.info(`Ładowanie pliku zawodników gości: ${awayPlayersPath}`);
        const awayPlayersRaw = await fs.readFile(path.join(__dirname, 'public', awayPlayersPath), 'utf8')
            .catch(err => { log.error(`Nie można wczytać ${awayPlayersPath}: ${err.message}`); return '[]'; });
        
        const homePlayersJson = JSON.parse(homePlayersRaw.charCodeAt(0) === 0xFEFF ? homePlayersRaw.slice(1) : homePlayersRaw);
        const awayPlayersJson = JSON.parse(awayPlayersRaw.charCodeAt(0) === 0xFEFF ? awayPlayersRaw.slice(1) : awayPlayersRaw);

        playersCache = { home: homePlayersJson, away: awayPlayersJson };
        playersCacheTime = now;
        log.success(`Załadowano ${homePlayersJson.length} zawodników gospodarzy i ${awayPlayersJson.length} zawodników gości`);
        res.json(playersCache);
      } catch (error) {
        log.error(`Błąd ładowania danych zawodników: ${error.message}`);
        res.status(500).json({ error: 'Błąd ładowania danych zawodników', details: error.message });
      }
});
app.get('/initial-intro-settings', async (req, res) => res.json(appState.introSettings) );
app.post('/update-intro-settings', upload.fields([{ name: 'homeLogo', maxCount: 1 }, { name: 'awayLogo', maxCount: 1 }]), async (req, res) => {
    log.info('Otrzymano żądanie /update-intro-settings');
    try {
        appState.introSettings.introHomeTeamFullName = req.body.introHomeTeamFullName || appState.introSettings.introHomeTeamFullName;
        appState.introSettings.introAwayTeamFullName = req.body.introAwayTeamFullName || appState.introSettings.introAwayTeamFullName;
        appState.introSettings.introMatchDate = req.body.introMatchDate || appState.introSettings.introMatchDate;
        appState.introSettings.introMatchTime = req.body.introMatchTime || appState.introSettings.introMatchTime;
        appState.introSettings.introMatchLocation = req.body.introMatchLocation || appState.introSettings.introMatchLocation;

        if (req.files && req.files.homeLogo && req.files.homeLogo[0]) {
            appState.introSettings.homeLogoPath = `/images/${req.files.homeLogo[0].filename}`;
            log.file(`Zaktualizowano ścieżkę logo gospodarzy na: ${appState.introSettings.homeLogoPath}`);
        }
        if (req.files && req.files.awayLogo && req.files.awayLogo[0]) {
            appState.introSettings.awayLogoPath = `/images/${req.files.awayLogo[0].filename}`;
            log.file(`Zaktualizowano ścieżkę logo gości na: ${appState.introSettings.awayLogoPath}`);
        }
        
        await saveIntroSettingsToFile();
        log.success("Zaktualizowane ustawienia Intro: " + JSON.stringify(appState.introSettings));
        res.json({ message: 'Ustawienia Intro zaktualizowane!', newSettings: appState.introSettings });

    } catch (error) {
        log.error(`Błąd aktualizacji ustawień Intro: ${error.message}`);
        res.status(500).json({ error: 'Błąd serwera podczas aktualizacji ustawień intro.', details: error.message });
    }
});

// --- ENDPOINT: /obs-status ---
app.get('/obs-status', async (req, res) => {
    let currentMicMuted = appState.obs.micMuted;
    let currentStreamActive = appState.obs.streamActive;
    let obsStatusText = appState.obs.connected ? 'Połączono z OBS' : 'Brak połączenia z OBS';
    let currentSelectedMic = appState.obs.selectedMicName;

    if (appState.obs.connected) {
        try {
            const streamStatus = await obs.call('GetStreamStatus');
            currentStreamActive = streamStatus.outputActive;
            appState.obs.streamActive = currentStreamActive; 
        } catch (e) {
            log.error(`Nie udało się pobrać aktualnego statusu streamu: ${e.message}`);
        }
        try {
            if (currentSelectedMic) { 
                const micStatus = await obs.call('GetInputMute', { inputName: currentSelectedMic });
                currentMicMuted = micStatus.inputMuted;
                appState.obs.micMuted = currentMicMuted; 
            } else {
                log.warn('Próba odczytu stanu mikrofonu, ale appState.obs.selectedMicName nie jest ustawione.');
                currentMicMuted = true; 
            }
        } catch (e) {
            log.error(`Nie udało się pobrać stanu mikrofonu ${currentSelectedMic}: ${e.message}`);
            obsStatusText = `Błąd odczytu mikrofonu: ${currentSelectedMic}. Sprawdź czy istnieje w OBS.`;
        }
    } else {
        currentStreamActive = false; 
        currentMicMuted = true; 
    }

    res.json({
        obsConnected: appState.obs.connected,
        streamActive: currentStreamActive,
        micMuted: currentMicMuted,
        selectedMicName: currentSelectedMic,
        obsStatusText: obsStatusText
    });
});

// --- ENDPOINT: /obs-audio-inputs ---
app.get('/obs-audio-inputs', requireOBSConnection, async (req, res) => {
    try {
        const kindsToTry = ['wasapi_input_capture', 'coreaudio_input_capture', 'pulse_input_capture', 'pipewire-input'];
        let allAudioInputs = [];
        for (const kind of kindsToTry) {
            try {
                const { inputs } = await obs.call('GetInputList', { inputKind: kind });
                if (inputs && inputs.length > 0) {
                    allAudioInputs.push(...inputs.filter(input => input.inputName));
                }
            } catch (kindError) { /* log.info(`Nie znaleziono wejść audio typu ${kind}`); */ }
        }
        const uniqueInputs = Array.from(new Set(allAudioInputs.map(a => a.inputName)))
            .map(name => ({ inputName: name })); 

        res.json({ inputs: uniqueInputs });
    } catch (error) {
        log.error(`Błąd pobierania listy wejść audio z OBS: ${error.message}`);
        res.status(500).json({ error: 'Błąd pobierania listy wejść audio z OBS', details: error.message });
    }
});


// --- ENDPOINT: /toggle-mic ---
app.post('/toggle-mic', requireOBSConnection, async (req, res) => {
  try {
    const { inputName, mute } = req.body; 
    if (typeof mute !== 'boolean') {
      return res.status(400).json({ error: 'Parametr "mute" musi być wartością boolean.' });
    }
    
    const targetMicName = inputName || appState.obs.selectedMicName; 
    if (!targetMicName) {
        return res.status(400).json({ error: 'Nie określono nazwy mikrofonu (inputName).' });
    }

    log.info(`Przełączanie mikrofonu: ${targetMicName} na ${mute ? 'wyciszony' : 'aktywny'}`);
    await obs.call('SetInputMute', { inputName: targetMicName, inputMuted: mute });
    
    appState.obs.selectedMicName = targetMicName; 
    appState.obs.micMuted = mute; 

    res.json({ muted: appState.obs.micMuted, selectedMicName: appState.obs.selectedMicName });
  } catch (error) {
    log.error(`Błąd przełączania mikrofonu (${req.body.inputName || appState.obs.selectedMicName}): ${error.message}`);
    res.status(500).json({ error: 'Błąd przełączania mikrofonu', details: error.message });
  }
});

app.post('/start-stream', requireOBSConnection, async (req, res) => {
    try {
        await obs.call('StartStream');
        appState.obs.streamActive = true; 
        log.stream('Stream uruchomiony przez API');
        res.json({ status: 'success', message: 'Stream uruchomiony', streamActive: true });
    } catch (error) {
        log.error(`Błąd uruchamiania streamu: ${error.message}`);
        res.status(500).json({ error: 'Błąd uruchamiania streamu', details: error.message });
    }
});
app.post('/stop-stream', requireOBSConnection, async (req, res) => {
    try {
        await obs.call('StopStream');
        appState.obs.streamActive = false; 
        log.stream('Stream zatrzymany przez API');
        res.json({ status: 'success', message: 'Stream zatrzymany', streamActive: false });
    } catch (error) {
        log.error(`Błąd zatrzymywania streamu: ${error.message}`);
        res.status(500).json({ error: 'Błąd zatrzymywania streamu', details: error.message });
    }
});
app.post('/switch-scene', requireOBSConnection, async (req, res) => { 
    const { sceneName } = req.body;
    if (!sceneName) {
        return res.status(400).json({ error: 'Nazwa sceny jest wymagana.' });
    }
    try {
        await obs.call('SetCurrentProgramScene', { sceneName });
        log.obs(`Przełączono na scenę: ${sceneName}`);
        res.json({ status: 'success', message: `Przełączono na scenę: ${sceneName}` });
    } catch (error) {
        log.error(`Błąd przełączania sceny na "${sceneName}": ${error.message}`);
        res.status(500).json({ error: `Błąd przełączania sceny na "${sceneName}"`, details: error.message });
    }
});

// --- ENDPOINT: /update-time ---
app.post('/update-time', (req, res) => {
  const { action, minute, second } = req.body;
  log.timer(`Otrzymano prośbę zmiany czasu: ${JSON.stringify(req.body)}`);
  try {
    switch (action) {
      case 'start': startServerTimer(); break;
      case 'pause': stopServerTimer(); break;
      case 'reset': resetServerTimer(); break;
      case 'set45':
        stopServerTimer();
        appState.timer.seconds = 45 * 60;
        updateTimerDisplay(); 
        log.timer('Ustawiono timer na 45:00');
        break;
      case 'setZero': resetServerTimer(); break; 
      case 'set': 
        if (minute !== undefined && second !== undefined) {
          const min = parseInt(minute);
          const sec = parseInt(second);
          if (isNaN(min) || isNaN(sec) || min < 0 || sec < 0 || sec >= 60) {
            return res.status(400).json({ error: 'Nieprawidłowe wartości czasu' });
          }
          stopServerTimer();
          appState.timer.seconds = min * 60 + sec;
          updateTimerDisplay(); 
          log.timer(`Ustawiono timer na ${appState.scorebug.minute}:${appState.scorebug.second}`);
        } else {
            return res.status(400).json({ error: 'Brakujące parametry minute/second dla akcji "set"' });
        }
        break;
      default:
        return res.status(400).json({ error: 'Nieznana akcja timera' });
    }
    res.json({ 
        status: 'success', 
        message: 'Czas zaktualizowany',
        running: appState.timer.running,
        minute: appState.scorebug.minute,
        second: appState.scorebug.second
    });
  } catch (error) {
    log.error(`Błąd aktualizacji czasu: ${error.message}`);
    res.status(500).json({ error: 'Błąd aktualizacji czasu', details: error.message });
  }
});

// --- ENDPOINT: /timer-state ---
app.get('/timer-state', (req, res) => {
    res.json({
        running: appState.timer.running,
        minute: appState.scorebug.minute,
        second: appState.scorebug.second,
    });
});


app.post('/update-scorebug', (req, res) => { 
    try {
        const validKeys = Object.keys(appState.scorebug);
        const updates = {};
        for (const [key, value] of Object.entries(req.body)) {
          if (validKeys.includes(key)) {
            if ((key === 'homeScore' || key === 'awayScore') && (typeof value !== 'number' || value < 0)) {
                log.error(`Nieprawidłowa wartość dla ${key}: ${value}`);
                return res.status(400).json({ error: `Nieprawidłowa wartość dla ${key}` });
            }
            updates[key] = value;
          }
        }
        if (Object.keys(updates).length === 0) {
            log.warn('Brak prawidłowych danych do aktualizacji scorebuga.');
            return res.status(400).json({ error: 'Brak prawidłowych danych do aktualizacji' });
        }
        Object.assign(appState.scorebug, updates);
        if (updates.minute !== undefined || updates.second !== undefined) {
          appState.timer.seconds = (parseInt(appState.scorebug.minute) || 0) * 60 + (parseInt(appState.scorebug.second) || 0);
        }
        log.success(`Zaktualizowano scorebug: ${JSON.stringify(updates)}`);
        res.json({ status: 'success', message: 'Scorebug zaktualizowany', updates });
      } catch (error) {
        log.error(`Błąd aktualizacji scorebug: ${error.message}`);
        res.status(500).json({ error: 'Błąd aktualizacji scorebug', details: error.message });
      }
});
app.post('/update-score', (req, res) => {
    try {
        const updates = {};
        if (req.body.team && (req.body.score !== undefined)) {
            const score = parseInt(req.body.score);
            if (isNaN(score) || score < 0) return res.status(400).json({ error: `Nieprawidłowy wynik dla ${req.body.team}` });
            if (req.body.team === 'home') {
                appState.scorebug.homeScore = score;
                updates.homeScore = score;
                log.info(`Zaktualizowano wynik gospodarzy: ${score}`);
            } else if (req.body.team === 'away') {
                appState.scorebug.awayScore = score;
                updates.awayScore = score;
                log.info(`Zaktualizowano wynik gości: ${score}`);
            } else {
                return res.status(400).json({ error: 'Nieprawidłowa drużyna' });
            }
        } else {
             return res.status(400).json({ error: 'Brakujące dane team lub score' });
        }
        
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Brak danych do aktualizacji' });
        res.json({ status: 'success', message: 'Wynik zaktualizowany', updates });
      } catch (error) {
        log.error(`Błąd aktualizacji wyniku: ${error.message}`);
        res.status(500).json({ error: 'Błąd aktualizacji wyniku', details: error.message });
      }
});
app.post('/update-notification', (req, res) => { 
    try {
        if (!req.body.type) return res.status(400).json({ error: 'Typ powiadomienia jest wymagany' });
        appState.notification = { ...req.body, timestamp: Date.now() };
        log.info(`Wysłano powiadomienie typu: ${appState.notification.type} dla drużyny: ${appState.notification.team || 'brak'}`);
        res.json({ status: 'success', message: 'Powiadomienie zaktualizowane' });
      } catch (error) {
        log.error(`Błąd aktualizacji powiadomienia: ${error.message}`);
        res.status(500).json({ error: 'Błąd aktualizacji powiadomienia', details: error.message });
      }
});
app.get('/health', (req, res) => { res.json({ status: 'ok', obsConnected: appState.obs.connected, timerRunning: appState.timer.running, uptime: process.uptime(), timestamp: new Date().toISOString() }) });
app.post('/api/clear-players-cache', (req, res) => { 
    playersCache = null;
    playersCacheTime = 0;
    log.info('Cache zawodników wyczyszczony');
    res.json({ status: 'success', message: 'Cache wyczyszczony' });
});

// Error handling middleware
app.use((err, req, res, next) => { 
    if (err instanceof multer.MulterError) {
        log.error(`Błąd Multer: ${err.message}`);
        return res.status(400).json({ error: `Błąd uploadu pliku: ${err.message}` });
    }
    log.error(`Błąd serwera: ${err.message} ${err.stack ? '\n' + err.stack : ''}`);
    res.status(500).json({ 
        error: 'Server error', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Wystąpił nieoczekiwany błąd'
    });
});
app.use('*', (req, res) => res.status(404).json({ error: 'Endpoint nie został znaleziony' }) );

async function gracefulShutdown() { 
    log.system('Rozpoczęto graceful shutdown...');
    if (appState.timer.interval) clearInterval(appState.timer.interval);
    if (appState.obs.connected && obs.socket) { // Sprawdź obs.socket
        try {
            await obs.disconnect();
            log.obs('Rozłączono z OBS.');
        } catch (e) {
            log.error('Błąd podczas rozłączania z OBS: ' + e.message);
        }
    }
    setTimeout(() => {
        log.system('Serwer zakończył działanie.');
        process.exit(0);
    }, 1000);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function startServer() {
    await loadIntroSettingsFromFile(); 
    await connectToOBS(); 

    app.listen(port, () => {
      const serverUrl = `http://10.21.96.130:${port}`;
      log.system('='.repeat(50));
      log.system(`Panel OBS uruchomiony!`);
      log.system(`Panel dostępny pod adresem: ${chalk.underline.cyan(serverUrl)}`);
      log.system(`Lokalny adres IP serwera (dla OBS): ${chalk.yellow(getLocalIp())}`);
      log.system(`Upewnij się, że OBS WebSocket jest skonfigurowany na: ws://${finalConfig.obs.host}:${finalConfig.obs.port}`);
      log.system(`Domyślny mikrofon z config.json: ${chalk.blue(safeGetConfig('obs.defaultMicName', 'Mikrofon (nie zdefiniowano w config)'))}`);
      log.system(`Naciśnij ${chalk.bold.yellow('Ctrl+C')} aby zatrzymać serwer`);
      log.system('='.repeat(50));
    });
}

startServer().catch(err => {
    log.error("Krytyczny błąd podczas uruchamiania serwera: " + err.message);
    process.exit(1);
});
