const express = require('express');
const fs = require('fs').promises; // Używamy fs.promises
const fsSync = require('fs'); // Pozostajemy przy fsSync tam, gdzie jest to konieczne (np. inicjalizacja configu)
const OBSWebSocket = require('obs-websocket-js').default;
const multer = require('multer'); // Dodano multer
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const { exec } = require('child_process');

const app = express();
const config = require('./config.json'); // Wczytaj oryginalny config, initializeConfig go zaktualizuje
const port = config.port;

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

// Inicjalizacja konfiguracji - wykonana tylko raz przy starcie
function initializeConfig() {
  const configPath = path.join(__dirname, 'config.json');
  try {
    let configRaw = fsSync.readFileSync(configPath, 'utf8');
    if (configRaw.charCodeAt(0) === 0xFEFF) {
      configRaw = configRaw.slice(1);
    }
    const configData = JSON.parse(configRaw);
    const localIp = getLocalIp();
    
    if (configData.obs && configData.obs.host !== localIp) {
      configData.obs.host = localIp;
      fsSync.writeFileSync(configPath, JSON.stringify(configData, null, 4), 'utf8');
      console.log(`Zaktualizowano obs.host w config.json na ${localIp}`);
    }
    return configData;
  } catch (err) {
    console.error('Błąd aktualizacji config.json:', err);
    return config;
  }
}

const finalConfig = initializeConfig(); // Wywołaj initializeConfig tutaj

// Konfiguracja kolorów dla różnych typów logów
const log = {
  system: (message) => console.log(chalk.bgBlue.white(' SYSTEM ') + ' ' + message),
  obs: (message) => console.log(chalk.bgMagenta.white(' OBS ') + ' ' + message),
  timer: (message) => console.log(chalk.bgYellow.black(' TIMER ') + ' ' + message),
  error: (message) => console.log(chalk.bgRed.white(' ERROR ') + ' ' + message),
  success: (message) => console.log(chalk.bgGreen.black(' SUCCESS ') + ' ' + message),
  info: (message) => console.log(chalk.bgCyan.black(' INFO ') + ' ' + message),
  stream: (message) => console.log(chalk.bgGreen.white(' STREAM ') + ' ' + message),
  file: (message) => console.log(chalk.bgWhite.black(' FILE ') + ' ' + message) // Dodano dla operacji na plikach
};

const obs = new OBSWebSocket();

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));

// --- Konfiguracja Multer dla uploadu logotypów ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public', 'images');
        if (!fsSync.existsSync(uploadPath)) {
            fsSync.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // file.originalname pochodzi z trzeciego argumentu formData.append() z frontendu
        // np. 'home_logo.png' lub 'opponent_logo.png'
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

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 2 // 2MB limit na plik
    },
    fileFilter: fileFilter
});


// Centralne przechowywanie stanu aplikacji
const appState = {
  scorebug: {
    homeName: 'AGR',
    awayName: 'LSN',
    homeScore: 0,
    awayScore: 0,
    minute: '00',
    second: '00',
    homeColor: '#C8102E',
    awayColor: '#1B449C',
    teamBackground: '#34003a',
    goalsBackground: '#00fc8a',
    timeBackground: '#ffffff',
    teamTextColor: '#ffffff',
    goalsTextColor: '#34003a',
    timeTextColor: '#34003a'
  },
  timer: {
    running: false,
    seconds: 0,
    interval: null
  },
  notification: null,
  mic: {
    muted: true
  },
  obs: {
    connected: false,
    reconnecting: false
  },
  // NOWY STAN: Ustawienia Intro
  introSettings: {
    introHomeTeamFullName: 'Domyślni Gospodarze Pełna Nazwa',
    introAwayTeamFullName: 'Domyślni Goście Pełna Nazwa',
    introMatchDate: '',
    introMatchTime: '',
    introMatchLocation: 'Domyślne Miejsce',
    homeLogoPath: '/images/agricola_logo.png', // Domyślna ścieżka, jeśli plik istnieje
    awayLogoPath: '/images/opponent_logo.png'  // Domyślna ścieżka, jeśli plik istnieje
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
            appState.introSettings = JSON.parse(data);
            // Upewnij się, że domyślne ścieżki są ustawione, jeśli brakuje ich w pliku i pliki istnieją
            const defaultHomeLogo = '/images/agricola_logo.png';
            const defaultOpponentLogo = '/images/opponent_logo.png';

            if (!appState.introSettings.homeLogoPath || !fsSync.existsSync(path.join(__dirname, 'public', appState.introSettings.homeLogoPath))) {
                 if(fsSync.existsSync(path.join(__dirname, 'public', defaultHomeLogo))) {
                    appState.introSettings.homeLogoPath = defaultHomeLogo;
                 } else {
                    // Jeśli nawet domyślne agricola_logo.png nie istnieje, zostaw puste lub ustaw placeholder
                    appState.introSettings.homeLogoPath = ''; // lub '/images/placeholder_logo.png'
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
            // Sprawdź czy domyślne loga istnieją przed ustawieniem ścieżek
            if (!fsSync.existsSync(path.join(__dirname, 'public', appState.introSettings.homeLogoPath))) appState.introSettings.homeLogoPath = '';
            if (!fsSync.existsSync(path.join(__dirname, 'public', appState.introSettings.awayLogoPath))) appState.introSettings.awayLogoPath = '';
            await saveIntroSettingsToFile(); // Zapisz domyślne, aby utworzyć plik
        }
    } catch (err) {
        log.error("Błąd odczytu ustawień intro z pliku: " + err.message);
    }
}


console.clear();
log.system('Inicjalizacja serwera...');

// Funkcje pomocnicze
function pad(number) {
  return number.toString().padStart(2, '0');
}

function updateTimerDisplay() {
  const minutes = Math.floor(appState.timer.seconds / 60);
  const secs = appState.timer.seconds % 60;
  appState.scorebug.minute = pad(minutes);
  appState.scorebug.second = pad(secs);
}

// Funkcje zarządzania timerem
function startServerTimer() {
  if (!appState.timer.running) {
    appState.timer.running = true;
    appState.timer.interval = setInterval(() => {
      appState.timer.seconds++;
      updateTimerDisplay();
    }, 1000);
    log.timer('Timer uruchomiony');
  } else {
    log.timer('Timer już działa');
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
  appState.scorebug.minute = '00';
  appState.scorebug.second = '00';
  log.timer('Timer zresetowany');
}

// Funkcje do zarządzania procesami
function killProcesses(callback) {
  exec('taskkill /IM obs64.exe /F && taskkill /IM node.exe /F', (error, stdout, stderr) => {
    if (error) log.error(`Błąd zamykania procesów: ${error.message}`);
    else log.system('Zamknięto OBS i Node.js');
    if (typeof callback === 'function') callback(error);
  });
}

function startSystem() {
  const scriptPath = path.join(__dirname, 'start_system.bat');
  exec(`start "" "${scriptPath}"`, (error) => {
    if (error) log.error(`Błąd uruchamiania systemu: ${error.message}`);
    else log.system('Uruchomiono system ponownie');
  });
}

async function connectToOBS() {
  if (appState.obs.reconnecting) return;
  const maxRetries = 5;
  let retries = 0;
  let backoffDelay = 5000;

  const tryConnect = async () => {
    if (appState.obs.reconnecting) return;
    appState.obs.reconnecting = true;
    try {
      await obs.connect(`ws://${finalConfig.obs.host}:${finalConfig.obs.port}`, finalConfig.obs.password);
      appState.obs.connected = true;
      appState.obs.reconnecting = false;
      log.success(`Połączono z OBS WebSocket na ${finalConfig.obs.host}:${finalConfig.obs.port}`);
      obs.on('StreamStateChanged', (data) => log.stream(data.outputActive ? 'Stream rozpoczęty' : 'Stream zakończony'));
      obs.on('ConnectionClosed', () => {
        appState.obs.connected = false;
        log.error('Połączenie z OBS zostało zamknięte. Próba ponownego połączenia...');
        setTimeout(() => { appState.obs.reconnecting = false; tryConnect(); }, backoffDelay);
      });
      try {
        const micStatus = await obs.call('GetInputMute', { inputName: 'Mikrofon' });
        appState.mic.muted = micStatus.inputMuted; // Poprawka: powinno być inputMuted
      } catch (error) {
        log.error(`Błąd sprawdzania stanu mikrofonu: ${error.message}`);
      }
      retries = 0;
      backoffDelay = 5000;
    } catch (error) {
      appState.obs.connected = false;
      log.error(`Błąd połączenia z OBS: ${error.message}`);
      retries++;
      if (retries < maxRetries) {
        backoffDelay = Math.min(30000, backoffDelay * 1.5);
        log.info(`Ponowna próba połączenia z OBS (${retries}/${maxRetries}) za ${backoffDelay/1000} sekund...`);
        setTimeout(() => { appState.obs.reconnecting = false; tryConnect(); }, backoffDelay);
      } else {
        log.error('Nie udało się połączyć z OBS po maksymalnej liczbie prób. Kolejna próba za 60 sekund.');
        retries = 0;
        setTimeout(() => { appState.obs.reconnecting = false; tryConnect(); }, 60000);
      }
    }
  };
  tryConnect();
}

function requireOBSConnection(req, res, next) {
  if (!appState.obs.connected) {
    return res.status(503).json({ error: 'Brak połączenia z OBS', message: 'OBS WebSocket nie jest połączony' });
  }
  next();
}

// API Endpoints
app.post('/api/restart', (req, res) => {
  log.system('Rozpoczęto restart systemu...');
  killProcesses((error) => {
    if (!error) startSystem();
    res.json({ status: error ? 'error' : 'success', message: error ? 'Błąd podczas restartu' : 'System restartowany' });
  });
});

app.post('/api/shutdown', (req, res) => {
  log.system('Rozpoczęto wyłączanie systemu...');
  killProcesses((error) => {
    res.json({ status: error ? 'error' : 'success', message: error ? 'Błąd podczas wyłączania' : 'System wyłączony' });
    if (!error) setTimeout(() => process.exit(0), 1000);
  });
});

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
    log.info(`Ładowanie pliku zawodników gospodarzy: ${finalConfig.teams.home}`);
    const homePlayers = await fs.readFile(path.join(__dirname, 'public', finalConfig.teams.home), 'utf8');
    log.info(`Ładowanie pliku zawodników gości: ${finalConfig.teams.away}`);
    const awayPlayers = await fs.readFile(path.join(__dirname, 'public', finalConfig.teams.away), 'utf8');
    const homePlayersJson = JSON.parse(homePlayers);
    const awayPlayersJson = JSON.parse(awayPlayers);
    playersCache = { home: homePlayersJson, away: awayPlayersJson };
    playersCacheTime = now;
    log.success(`Załadowano ${homePlayersJson.length} zawodników gospodarzy i ${awayPlayersJson.length} zawodników gości`);
    res.json(playersCache);
  } catch (error) {
    log.error(`Błąd ładowania danych zawodników: ${error.message}`);
    res.status(500).json({ error: 'Błąd ładowania danych zawodników' });
  }
});

// --- NOWE ENDPOINTY DLA USTAWIEŃ INTRO ---
app.get('/initial-intro-settings', async (req, res) => {
    // Nie ma potrzeby await, bo loadIntroSettingsFromFile modyfikuje appState.introSettings synchronicznie
    // lub jeśli plik nie istnieje, używa wartości domyślnych z appState.
    // loadIntroSettingsFromFile jest wywoływane przy starcie serwera.
    res.json(appState.introSettings);
});

app.post('/update-intro-settings', upload.fields([{ name: 'homeLogo', maxCount: 1 }, { name: 'awayLogo', maxCount: 1 }]), async (req, res) => {
    log.info('Otrzymano żądanie /update-intro-settings');
    // log.info('Body: ' + JSON.stringify(req.body));
    // log.info('Files: ' + JSON.stringify(req.files));
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


// OBS endpoints
app.get('/stream-status', requireOBSConnection, async (req, res) => {
  try {
    const streamStatus = await obs.call('GetStreamStatus');
    res.json({ streaming: streamStatus.outputActive });
  } catch (error) {
    log.error(`Błąd pobierania statusu streamu: ${error.message}`);
    res.status(500).json({ error: 'Błąd pobierania statusu streamu' });
  }
});

app.post('/toggle-mic', requireOBSConnection, async (req, res) => {
  try {
    const { mute } = req.body;
    if (typeof mute !== 'boolean') return res.status(400).json({ error: 'Parametr mute musi być boolean' });
    await obs.call('SetInputMute', { inputName: 'Mikrofon', inputMuted: mute });
    appState.mic.muted = mute;
    log.info(`Mikrofon ${appState.mic.muted ? 'wyciszony' : 'aktywny'}`);
    res.json({ muted: appState.mic.muted });
  } catch (error) {
    log.error(`Błąd przełączania mikrofonu: ${error.message}`);
    res.status(500).json({ error: 'Błąd przełączania mikrofonu' });
  }
});

app.post('/start-stream', requireOBSConnection, async (req, res) => {
  try {
    await obs.call('StartStream');
    log.stream('Stream uruchomiony');
    res.json({ status: 'success', message: 'Stream uruchomiony' });
  } catch (error) {
    log.error(`Błąd uruchamiania streamu: ${error.message}`);
    res.status(500).json({ error: 'Błąd uruchamiania streamu' });
  }
});

app.post('/stop-stream', requireOBSConnection, async (req, res) => {
  try {
    await obs.call('StopStream');
    log.stream('Stream zatrzymany');
    res.json({ status: 'success', message: 'Stream zatrzymany' });
  } catch (error) {
    log.error(`Błąd zatrzymywania streamu: ${error.message}`);
    res.status(500).json({ error: 'Błąd zatrzymywania streamu' });
  }
});

app.post('/switch-scene', requireOBSConnection, async (req, res) => {
  try {
    const { sceneName } = req.body;
    if (!sceneName || typeof sceneName !== 'string') return res.status(400).json({ error: 'Nazwa sceny jest wymagana' });
    await obs.call('SetCurrentProgramScene', { sceneName });
    log.obs(`Przełączono na scenę: ${sceneName}`);
    res.json({ status: 'success', message: `Przełączono na scenę: ${sceneName}` });
  } catch (error) {
    log.error(`Błąd przełączania sceny: ${error.message}`);
    res.status(500).json({ error: 'Błąd przełączania sceny' });
  }
});

// Timer endpoints
app.get('/timer-state', (req, res) => res.json({ running: appState.timer.running, seconds: appState.timer.seconds, minute: appState.scorebug.minute, second: appState.scorebug.second }));

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
        appState.scorebug.minute = '45';
        appState.scorebug.second = '00';
        log.timer('Ustawiono timer na 45:00');
        break;
      case 'setZero': resetServerTimer(); break;
      default:
        if (minute !== undefined && second !== undefined) {
          const min = parseInt(minute);
          const sec = parseInt(second);
          if (isNaN(min) || isNaN(sec) || min < 0 || sec < 0 || sec >= 60) return res.status(400).json({ error: 'Nieprawidłowe wartości czasu' });
          stopServerTimer();
          appState.scorebug.minute = pad(min);
          appState.scorebug.second = pad(sec);
          appState.timer.seconds = min * 60 + sec;
          log.timer(`Ustawiono timer na ${appState.scorebug.minute}:${appState.scorebug.second}`);
        }
    }
    res.json({ status: 'success', message: 'Czas zaktualizowany' });
  } catch (error) {
    log.error(`Błąd aktualizacji czasu: ${error.message}`);
    res.status(500).json({ error: 'Błąd aktualizacji czasu' });
  }
});

app.post('/update-scorebug', (req, res) => {
  try {
    const validKeys = Object.keys(appState.scorebug);
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (validKeys.includes(key)) {
        if ((key === 'homeScore' || key === 'awayScore') && (typeof value !== 'number' || value < 0)) return res.status(400).json({ error: `Nieprawidłowa wartość dla ${key}` });
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Brak prawidłowych danych do aktualizacji' });
    Object.assign(appState.scorebug, updates);
    if (updates.minute !== undefined || updates.second !== undefined) {
      appState.timer.seconds = (parseInt(appState.scorebug.minute) || 0) * 60 + (parseInt(appState.scorebug.second) || 0);
    }
    log.success(`Zaktualizowano scorebug: ${JSON.stringify(updates)}`);
    res.json({ status: 'success', message: 'Scorebug zaktualizowany', updates });
  } catch (error) {
    log.error(`Błąd aktualizacji scorebug: ${error.message}`);
    res.status(500).json({ error: 'Błąd aktualizacji scorebug' });
  }
});

app.post('/update-score', (req, res) => {
  try {
    const updates = {};
    if (req.body.homeScore !== undefined) {
      const score = parseInt(req.body.homeScore);
      if (isNaN(score) || score < 0) return res.status(400).json({ error: 'Nieprawidłowy wynik gospodarzy' });
      appState.scorebug.homeScore = score;
      updates.homeScore = score;
      log.info(`Zaktualizowano wynik gospodarzy: ${score}`);
    }
    if (req.body.awayScore !== undefined) {
      const score = parseInt(req.body.awayScore);
      if (isNaN(score) || score < 0) return res.status(400).json({ error: 'Nieprawidłowy wynik gości' });
      appState.scorebug.awayScore = score;
      updates.awayScore = score;
      log.info(`Zaktualizowano wynik gości: ${score}`);
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Brak danych do aktualizacji' });
    res.json({ status: 'success', message: 'Wynik zaktualizowany', updates });
  } catch (error) {
    log.error(`Błąd aktualizacji wyniku: ${error.message}`);
    res.status(500).json({ error: 'Błąd aktualizacji wyniku' });
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
    res.status(500).json({ error: 'Błąd aktualizacji powiadomienia' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', obsConnected: appState.obs.connected, timerRunning: appState.timer.running, uptime: process.uptime(), timestamp: new Date().toISOString() }));
app.post('/api/clear-players-cache', (req, res) => {
  playersCache = null;
  playersCacheTime = 0;
  log.info('Cache zawodników wyczyszczony');
  res.json({ status: 'success', message: 'Cache wyczyszczony' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Obsługa błędów Multera
    if (err instanceof multer.MulterError) {
        log.error(`Błąd Multer: ${err.message}`);
        return res.status(400).json({ error: `Błąd uploadu pliku: ${err.message}` });
    }
    // Inne błędy serwera
    log.error(`Błąd serwera: ${err.message} ${err.stack ? '\n' + err.stack : ''}`);
    res.status(500).json({ 
        error: 'Server error', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Wystąpił nieoczekiwany błąd'
    });
});

app.use('*', (req, res) => res.status(404).json({ error: 'Endpoint nie został znaleziony' }));

async function gracefulShutdown() {
    log.system('Rozpoczęto graceful shutdown...');
    if (appState.timer.interval) clearInterval(appState.timer.interval);
    if (appState.obs.connected) {
        try {
            await obs.disconnect();
            log.obs('Rozłączono z OBS.');
        } catch (e) {
            log.error('Błąd podczas rozłączania z OBS: ' + e.message);
        }
    }
    // Daj trochę czasu na zakończenie operacji asynchronicznych
    setTimeout(() => {
        log.system('Serwer zakończył działanie.');
        process.exit(0);
    }, 1000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Inicjalizacja ustawień i start serwera
async function startServer() {
    await loadIntroSettingsFromFile(); // Załaduj ustawienia intro przed startem serwera
    await connectToOBS(); // Uruchom połączenie z OBS

    app.listen(port, () => {
      const serverUrl = `http://localhost:${port}`;
      log.system('='.repeat(50));
      log.system(`Panel Agricola OBS uruchomiony!`);
      log.system(`Panel dostępny pod adresem: ${chalk.underline.cyan(serverUrl)}`);
      log.system(`Naciśnij ${chalk.bold.yellow('Ctrl+C')} aby zatrzymać serwer`);
      log.system('='.repeat(50));
    });
}

startServer().catch(err => {
    log.error("Krytyczny błąd podczas uruchamiania serwera: " + err.message);
    process.exit(1);
});