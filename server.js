const express = require('express');
const fs = require('fs').promises;
// Poprawny import dla wersji 5.0.0
const OBSWebSocket = require('obs-websocket-js').default;
const app = express();
const config = require('./config.json');
const port = config.port;
const chalk = require('chalk');

// Konfiguracja kolorów dla różnych typów logów
const log = {
  system: (message) => console.log(chalk.bgBlue.white(' SYSTEM ') + ' ' + message),
  obs: (message) => console.log(chalk.bgMagenta.white(' OBS ') + ' ' + message),
  timer: (message) => console.log(chalk.bgYellow.black(' TIMER ') + ' ' + message),
  error: (message) => console.log(chalk.bgRed.white(' ERROR ') + ' ' + message),
  success: (message) => console.log(chalk.bgGreen.black(' SUCCESS ') + ' ' + message),
  info: (message) => console.log(chalk.bgCyan.black(' INFO ') + ' ' + message),
  stream: (message) => console.log(chalk.bgGreen.white(' STREAM ') + ' ' + message)
};

const obs = new OBSWebSocket();

app.use(express.static('public'));
app.use(express.json());

let scorebugData = {
  homeName: 'AGR',
  awayName: 'BRZ',
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
};

let timerState = {
  running: false,
  seconds: 0
};

let notificationData = null;

let timerInterval = null;

// Stan mikrofonu
let micMuted = true;

// Połączenie z OBS
async function connectToOBS() {
  const maxRetries = 5;
  let retries = 0;
  let backoffDelay = 5000; // Start with 5 seconds

  const tryConnect = async () => {
    try {
      await obs.connect(`ws://${config.obs.host}:${config.obs.port}`, config.obs.password);
      log.success(`Połączono z OBS WebSocket na ${config.obs.host}:${config.obs.port}`);

      obs.on('StreamStateChanged', (data) => {
        log.stream(data.outputActive ? 'Stream rozpoczęty' : 'Stream zakończony');
      });

      obs.on('ConnectionClosed', () => {
        log.error('Połączenie z OBS zostało zamknięte. Próba ponownego połączenia...');
        setTimeout(tryConnect, backoffDelay);
      });

      // Check initial microphone state
      try {
        const micStatus = await obs.call('GetInputMute', { inputName: 'Mikrofon' });
        micMuted = micStatus.muted;
        log.info(`Stan mikrofonu: ${micMuted ? 'wyciszony' : 'aktywny'}`);
      } catch (error) {
        log.error(`Błąd sprawdzania stanu mikrofonu: ${error.message}`);
      }
      
      // Reset retry counter on successful connection
      retries = 0;
      backoffDelay = 5000;
    } catch (error) {
      log.error(`Błąd połączenia z OBS: ${error.message}`);
      retries++;
      
      if (retries < maxRetries) {
        // Exponential backoff
        backoffDelay = Math.min(30000, backoffDelay * 1.5); 
        log.info(`Ponowna próba połączenia z OBS (${retries}/${maxRetries}) za ${backoffDelay/1000} sekund...`);
        setTimeout(tryConnect, backoffDelay);
      } else {
        log.error('Nie udało się połączyć z OBS po maksymalnej liczbie prób. Kolejna próba za 60 sekund.');
        retries = 0;
        setTimeout(tryConnect, 60000);
      }
    }
  };

  tryConnect();
}
connectToOBS();

function startServerTimer() {
  if (!timerState.running) {
    timerState.running = true;
    timerInterval = setInterval(() => {
      timerState.seconds++;
      const minutes = Math.floor(timerState.seconds / 60);
      const secs = timerState.seconds % 60;
      scorebugData.minute = pad(minutes);
      scorebugData.second = pad(secs);
    }, 1000);
    log.timer('Timer uruchomiony');
  } else {
    log.timer('Timer już działa');
  }
}

function stopServerTimer() {
  if (timerState.running) {
    timerState.running = false;
    clearInterval(timerInterval);
    timerInterval = null;
    log.timer('Timer zatrzymany');
  }
}

function resetServerTimer() {
  stopServerTimer();
  timerState.seconds = 0;
  scorebugData.minute = '00';
  scorebugData.second = '00';
  log.timer('Timer zresetowany');
}

function pad(number) {
  return number.toString().padStart(2, '0');
}

app.get('/scorebug-data', (req, res) => {
  res.json(scorebugData);
});

app.get('/notification-data', (req, res) => {
  res.json(notificationData || {});
});

app.get('/initial-settings', (req, res) => {
  res.json({
    homeName: scorebugData.homeName,
    awayName: scorebugData.awayName,
    homeScore: scorebugData.homeScore,
    awayScore: scorebugData.awayScore,
    minute: scorebugData.minute,
    second: scorebugData.second,
    homeColor: scorebugData.homeColor,
    awayColor: scorebugData.awayColor,
    teamBackground: scorebugData.teamBackground,
    goalsBackground: scorebugData.goalsBackground,
    timeBackground: scorebugData.timeBackground,
    teamTextColor: scorebugData.teamTextColor,
    goalsTextColor: scorebugData.goalsTextColor,
    timeTextColor: scorebugData.timeTextColor
  });
});

app.get('/players-data', async (req, res) => {
  try {
    log.info(`Ładowanie pliku zawodników gospodarzy: ${config.teams.home}`);
    const homePlayers = await fs.readFile(`public/${config.teams.home}`, 'utf8');
    log.info(`Ładowanie pliku zawodników gości: ${config.teams.away}`);
    const awayPlayers = await fs.readFile(`public/${config.teams.away}`, 'utf8');
    
    const homePlayersJson = JSON.parse(homePlayers);
    const awayPlayersJson = JSON.parse(awayPlayers);
    
    log.success(`Załadowano ${homePlayersJson.length} zawodników gospodarzy i ${awayPlayersJson.length} zawodników gości`);
    
    res.json({
      home: homePlayersJson,
      away: awayPlayersJson
    });
  } catch (error) {
    log.error(`Błąd ładowania danych zawodników: ${error.message}`);
    res.status(500).json({ error: 'Błąd ładowania danych zawodników' });
  }
});

app.get('/stream-status', async (req, res) => {
  try {
    const streamStatus = await obs.call('GetStreamStatus');
    res.json({ streaming: streamStatus.outputActive });
  } catch (error) {
    log.error(`Błąd pobierania statusu streamu: ${error.message}`);
    if (error.code === 'NOT_CONNECTED') {
      res.json({ streaming: false, error: 'Brak połączenia z OBS' });
    } else {
      res.status(500).json({ error: 'Błąd pobierania statusu streamu' });
    }
  }
});

// Endpoint do sprawdzania stanu timera
app.get('/timer-state', (req, res) => {
  res.json({
    running: timerState.running,
    seconds: timerState.seconds,
    minute: scorebugData.minute,
    second: scorebugData.second
  });
});

// Nowy endpoint do przełączania stanu mikrofonu
app.post('/toggle-mic', async (req, res) => {
  try {
    const { mute } = req.body;
    await obs.call('SetInputMute', { inputName: 'Mikrofon', inputMuted: mute });
    micMuted = mute;
    log.info(`Mikrofon ${micMuted ? 'wyciszony' : 'aktywny'}`);
    res.json({ muted: micMuted });
  } catch (error) {
    log.error(`Błąd przełączania mikrofonu: ${error.message}`);
    res.status(500).json({ error: 'Błąd przełączania mikrofonu' });
  }
});

app.post('/update-scorebug', (req, res) => {
  try {
    // Validate input
    const validKeys = Object.keys(scorebugData);
    const updates = {};
    
    for (const [key, value] of Object.entries(req.body)) {
      if (validKeys.includes(key)) {
        updates[key] = value;
      }
    }
    
    // Update state
    scorebugData = { ...scorebugData, ...updates };
    
    // Update timer seconds if minute/second were updated
    if (updates.minute !== undefined || updates.second !== undefined) {
      timerState.seconds = (parseInt(scorebugData.minute) || 0) * 60 + (parseInt(scorebugData.second) || 0);
    }
    
    log.success(`Zaktualizowano scorebug: ${JSON.stringify(updates)}`);
    res.status(200).send('Scorebug updated');
  } catch (error) {
    log.error(`Błąd aktualizacji scorebug: ${error.message}`);
    res.status(500).send('Error updating scorebug');
  }
});

app.post('/update-time', (req, res) => {
  const { action, minute, second } = req.body;
  log.timer(`Otrzymano prośbę zmiany czasu: ${JSON.stringify(req.body)}`);
  
  try {
    if (action === 'start') {
      startServerTimer();
    } else if (action === 'pause') {
      stopServerTimer();
    } else if (action === 'reset') {
      resetServerTimer();
    } else if (action === 'set45') {
      stopServerTimer();
      timerState.seconds = 45 * 60;
      scorebugData.minute = '45';
      scorebugData.second = '00';
      log.timer('Ustawiono timer na 45:00');
    } else if (action === 'setZero') {
      resetServerTimer();
    } else if (minute !== undefined && second !== undefined) {
      stopServerTimer();
      scorebugData.minute = minute.toString().padStart(2, '0');
      scorebugData.second = second.toString().padStart(2, '0');
      timerState.seconds = (parseInt(minute) || 0) * 60 + (parseInt(second) || 0);
      log.timer(`Ustawiono timer na ${scorebugData.minute}:${scorebugData.second}`);
    }
    
    res.status(200).send('Czas zaktualizowany');
  } catch (error) {
    log.error(`Błąd aktualizacji czasu: ${error.message}`);
    res.status(500).send('Error updating time');
  }
});

app.post('/update-score', (req, res) => {
  if (req.body.homeScore !== undefined) {
    scorebugData.homeScore = req.body.homeScore;
    log.info(`Zaktualizowano wynik gospodarzy: ${scorebugData.homeScore}`);
  }
  if (req.body.awayScore !== undefined) {
    scorebugData.awayScore = req.body.awayScore;
    log.info(`Zaktualizowano wynik gości: ${scorebugData.awayScore}`);
  }
  res.send('Wynik zaktualizowany');
});

app.post('/update-notification', (req, res) => {
  notificationData = {
    ...req.body,
    timestamp: Date.now()
  };
  log.info(`Wysłano powiadomienie typu: ${notificationData.type} dla drużyny: ${notificationData.team}`);
  res.send('Powiadomienie zaktualizowane');
});

app.post('/start-stream', async (req, res) => {
  try {
    await obs.call('StartStream');
    log.stream('Stream uruchomiony');
    res.send('Stream uruchomiony');
  } catch (error) {
    log.error(`Błąd uruchamiania streamu: ${error.message}`);
    res.status(500).send('Błąd uruchamiania streamu');
  }
});

app.post('/stop-stream', async (req, res) => {
  try {
    await obs.call('StopStream');
    log.stream('Stream zatrzymany');
    res.send('Stream zatrzymany');
  } catch (error) {
    log.error(`Błąd zatrzymywania streamu: ${error.message}`);
    res.status(500).send('Błąd zatrzymywania streamu');
  }
});

app.post('/switch-scene', async (req, res) => {
  try {
    const { sceneName } = req.body;
    await obs.call('SetCurrentProgramScene', { sceneName });
    log.obs(`Przełączono na scenę: ${sceneName}`);
    res.send(`Przełączono na scenę: ${sceneName}`);
  } catch (error) {
    log.error(`Błąd przełączania sceny: ${error.message}`);
    res.status(500).send('Błąd przełączania sceny');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    obsConnected: obs.connected,
    timerRunning: timerState.running,
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  log.error(`Błąd serwera: ${err.message}`);
  res.status(500).json({ 
    error: 'Server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

app.listen(port, () => {
  const serverUrl = `http://localhost:${port}`;
  log.system('='.repeat(50));
  log.system(`Panel Agricola OBS uruchomiony!`);
  log.system(`Panel dostępny pod adresem: ${chalk.underline.cyan(serverUrl)}`);
  log.system(`Naciśnij ${chalk.bold.yellow('Ctrl+C')} aby zatrzymać serwer`);
  log.system('='.repeat(50));
});