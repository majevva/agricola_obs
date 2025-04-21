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

// Połączenie z OBS
async function connectToOBS() {
  const maxRetries = 5;
  let retries = 0;

  const tryConnect = async () => {
    try {
      await obs.connect(`ws://${config.obs.host}:${config.obs.port}`, config.obs.password);
      console.log('Połączono z OBS');

      obs.on('StreamStateChanged', (data) => {
        console.log(data.outputActive ? 'Stream Started' : 'Stream Stopped');
      });

      obs.on('ConnectionClosed', () => {
        console.log('Połączenie z OBS zamknięte. Ponawiam próbę...');
        setTimeout(tryConnect, 5000); // Ponów próbę po 5 sekundach
      });
    } catch (error) {
      console.error('Błąd połączenia z OBS:', error);
      retries++;
      if (retries < maxRetries) {
        console.log(`Ponawiam próbę połączenia (${retries}/${maxRetries})...`);
        setTimeout(tryConnect, 5000); // Ponów próbę po 5 sekundach
      } else {
        console.error('Nie udało się połączyć z OBS po maksymalnej liczbie prób.');
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
    const homePlayers = await fs.readFile(`public/${config.teams.home}`, 'utf8');
    const awayPlayers = await fs.readFile(`public/${config.teams.away}`, 'utf8');
    res.json({
      home: JSON.parse(homePlayers),
      away: JSON.parse(awayPlayers)
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

app.post('/update-scorebug', (req, res) => {
  scorebugData = { ...scorebugData, ...req.body };
  timerState.seconds = (parseInt(scorebugData.minute) || 0) * 60 + (parseInt(scorebugData.second) || 0);
  res.send('Scorebug zaktualizowany');
});

app.post('/update-time', (req, res) => {
  const { action, minute, second } = req.body;
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
  } else if (action === 'setZero') {
    resetServerTimer();
  } else if (minute !== undefined && second !== undefined) {
    stopServerTimer();
    scorebugData.minute = minute;
    scorebugData.second = second;
    timerState.seconds = (parseInt(minute) || 0) * 60 + (parseInt(second) || 0);
  }
  res.send('Czas zaktualizowany');
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

app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
});