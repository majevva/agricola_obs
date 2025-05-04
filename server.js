const express = require('express');
const fs = require('fs').promises;
// Poprawny import dla wersji 5.0.0
const OBSWebSocket = require('obs-websocket-js').default;
const app = express();
const config = require('./config.json');
const port = config.port;

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
      console.log('Connected to OBS');

      obs.on('StreamStateChanged', (data) => {
        console.log(data.outputActive ? 'Stream Started' : 'Stream Stopped');
      });

      obs.on('ConnectionClosed', () => {
        console.log('OBS connection closed. Attempting to reconnect...');
        setTimeout(tryConnect, backoffDelay);
      });

      // Check initial microphone state
      try {
        const micStatus = await obs.call('GetInputMute', { inputName: 'Mikrofon' });
        micMuted = micStatus.muted;
      } catch (error) {
        console.error('Error checking microphone state:', error);
      }
      
      // Reset retry counter on successful connection
      retries = 0;
      backoffDelay = 5000;
    } catch (error) {
      console.error('OBS connection error:', error);
      retries++;
      
      if (retries < maxRetries) {
        // Exponential backoff
        backoffDelay = Math.min(30000, backoffDelay * 1.5); 
        console.log(`Reconnecting to OBS (${retries}/${maxRetries}) in ${backoffDelay/1000} seconds...`);
        setTimeout(tryConnect, backoffDelay);
      } else {
        console.error('Failed to connect to OBS after maximum attempts. Will retry in 60 seconds.');
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
    console.log('Server timer started');
  } else {
    console.log('Timer already running');
  }
}

function stopServerTimer() {
  if (timerState.running) {
    timerState.running = false;
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetServerTimer() {
  stopServerTimer();
  timerState.seconds = 0;
  scorebugData.minute = '00';
  scorebugData.second = '00';
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
    console.log(`Próba odczytu pliku: public/${config.teams.home}`);
    const homePlayers = await fs.readFile(`public/${config.teams.home}`, 'utf8');
    console.log(`Próba odczytu pliku: public/${config.teams.away}`);
    const awayPlayers = await fs.readFile(`public/${config.teams.away}`, 'utf8');
    
    console.log('Parsowanie pliku home players');
    const homePlayersJson = JSON.parse(homePlayers);
    
    console.log('Parsowanie pliku away players');
    const awayPlayersJson = JSON.parse(awayPlayers);
    
    res.json({
      home: homePlayersJson,
      away: awayPlayersJson
    });
  } catch (error) {
    console.error('Błąd ładowania danych zawodników:', error);
    res.status(500).json({ error: 'Błąd ładowania danych zawodników' });
  }
});

app.get('/stream-status', async (req, res) => {
  try {
    const streamStatus = await obs.call('GetStreamStatus');
    res.json({ streaming: streamStatus.outputActive });
  } catch (error) {
    console.error('Błąd pobierania statusu streamu:', error);
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
    res.json({ muted: micMuted });
  } catch (error) {
    console.error('Błąd przełączania mikrofonu:', error);
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
    
    res.status(200).send('Scorebug updated');
  } catch (error) {
    console.error('Error updating scorebug:', error);
    res.status(500).send('Error updating scorebug');
  }
});

app.post('/update-time', (req, res) => {
  const { action, minute, second } = req.body;
  console.log('Received time update request:', req.body);
  
  try {
    if (action === 'start') {
      console.log('Starting timer');
      startServerTimer();
    } else if (action === 'pause') {
      console.log('Pausing timer');
      stopServerTimer();
    } else if (action === 'reset') {
      console.log('Resetting timer');
      resetServerTimer();
    } else if (action === 'set45') {
      console.log('Setting timer to 45:00');
      stopServerTimer();
      timerState.seconds = 45 * 60;
      scorebugData.minute = '45';
      scorebugData.second = '00';
    } else if (action === 'setZero') {
      console.log('Setting timer to 00:00');
      resetServerTimer();
    } else if (minute !== undefined && second !== undefined) {
      console.log(`Setting timer to ${minute}:${second}`);
      stopServerTimer();
      scorebugData.minute = minute.toString().padStart(2, '0');
      scorebugData.second = second.toString().padStart(2, '0');
      timerState.seconds = (parseInt(minute) || 0) * 60 + (parseInt(second) || 0);
    }
    
    res.status(200).send('Czas zaktualizowany');
  } catch (error) {
    console.error('Error updating time:', error);
    res.status(500).send('Error updating time');
  }
});

app.post('/update-score', (req, res) => {
  if (req.body.homeScore !== undefined) {
    scorebugData.homeScore = req.body.homeScore;
  }
  if (req.body.awayScore !== undefined) {
    scorebugData.awayScore = req.body.awayScore;
  }
  res.send('Wynik zaktualizowany');
});

app.post('/update-notification', (req, res) => {
  notificationData = {
    ...req.body,
    timestamp: Date.now()
  };
  res.send('Powiadomienie zaktualizowane');
});

app.post('/start-stream', async (req, res) => {
  try {
    await obs.call('StartStream');
    res.send('Stream uruchomiony');
  } catch (error) {
    console.error('Błąd uruchamiania streamu:', error);
    res.status(500).send('Błąd uruchamiania streamu');
  }
});

app.post('/stop-stream', async (req, res) => {
  try {
    await obs.call('StopStream');
    res.send('Stream zatrzymany');
  } catch (error) {
    console.error('Błąd zatrzymywania streamu:', error);
    res.status(500).send('Błąd zatrzymywania streamu');
  }
});

app.post('/switch-scene', async (req, res) => {
  try {
    const { sceneName } = req.body;
    await obs.call('SetCurrentProgramScene', { sceneName });
    res.send(`Przełączono na scenę: ${sceneName}`);
  } catch (error) {
    console.error('Błąd przełączania sceny:', error);
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
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
});