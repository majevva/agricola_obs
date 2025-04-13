const obs = new OBSWebSocket();
let homeScore = 0;
let awayScore = 0;
let selectedPlayers = [];
let notificationType = 'change';
let notificationTeam = 'home';

async function connectToOBS() {
  try {
    const config = await fetch('/config.json').then(res => res.json());
    await obs.connect(`ws://${config.obs.host}:${config.obs.port}`, config.obs.password);
    console.log('Połączono z OBS');

    obs.on('StreamStarted', () => {
      document.getElementById('stream-status').textContent = 'ON';
      document.getElementById('stream-status').classList.remove('status-off');
      document.getElementById('stream-status').classList.add('status-on');
      document.querySelector('.status-item i').classList.remove('text-red-500');
      document.querySelector('.status-item i').classList.add('text-green-500');
    });

    obs.on('StreamStopped', () => {
      document.getElementById('stream-status').textContent = 'OFF';
      document.getElementById('stream-status').classList.remove('status-on');
      document.getElementById('stream-status').classList.add('status-off');
      document.querySelector('.status-item i').classList.remove('text-green-500');
      document.querySelector('.status-item i').classList.add('text-red-500');
    });

    const streamStatus = await obs.send('GetStreamingStatus');
    if (streamStatus.streaming) {
      document.getElementById('stream-status').textContent = 'ON';
      document.getElementById('stream-status').classList.add('status-on');
      document.querySelector('.status-item i').classList.add('text-green-500');
    }
  } catch (error) {
    console.error('Błąd połączenia z OBS:', error);
  }
}

connectToOBS();

async function loadInitialSettings() {
  try {
    const response = await fetch('/initial-settings');
    const settings = await response.json();

    document.getElementById('home-team-name').value = settings.homeName || 'GOSPODARZE';
    document.getElementById('away-team-name').value = settings.awayName || 'GOŚCIE';
    document.getElementById('home-team-color').value = settings.homeColor || '#C8102E';
    document.getElementById('away-team-color').value = settings.awayColor || '#1B449C';
    document.getElementById('home-hex').textContent = settings.homeColor || '#C8102E';
    document.getElementById('away-hex').textContent = settings.awayColor || '#1B449C';
    document.getElementById('home-score-bug').value = settings.homeScore || 0;
    document.getElementById('away-score-bug').value = settings.awayScore || 0;
    document.getElementById('match-minute').value = parseInt(settings.minute) || 0;
    document.getElementById('match-second').value = parseInt(settings.second) || 0;
    document.getElementById('team-background').value = settings.teamBackground || '#34003a';
    document.getElementById('goals-background').value = settings.goalsBackground || '#00fc8a';
    document.getElementById('time-background').value = settings.timeBackground || '#ffffff';
    document.getElementById('team-background-hex').textContent = settings.teamBackground || '#34003a';
    document.getElementById('goals-background-hex').textContent = settings.goalsBackground || '#00fc8a';
    document.getElementById('time-background-hex').textContent = settings.timeBackground || '#ffffff';
    document.getElementById('team-text-color').value = settings.teamTextColor || '#ffffff';
    document.getElementById('goals-text-color').value = settings.goalsTextColor || '#34003a';
    document.getElementById('time-text-color').value = settings.timeTextColor || '#34003a';
    document.getElementById('team-text-color-hex').textContent = settings.teamTextColor || '#ffffff';
    document.getElementById('goals-text-color-hex').textContent = settings.goalsTextColor || '#34003a';
    document.getElementById('time-text-color-hex').textContent = settings.timeTextColor || '#34003a';

    document.getElementById('preview-home-name').textContent = settings.homeName || 'GOSPODARZE';
    document.getElementById('preview-away-name').textContent = settings.awayName || 'GOŚCIE';
    document.getElementById('preview-home-score').textContent = settings.homeScore || 0;
    document.getElementById('preview-away-score').textContent = settings.awayScore || 0;
    document.getElementById('preview-minute').textContent = settings.minute || '00';
    document.getElementById('preview-second').textContent = settings.second || '00';
    document.querySelector('#scorebug-tab .team.home .color').style.backgroundColor = settings.homeColor || '#C8102E';
    document.querySelector('#scorebug-tab .team.away .color').style.backgroundColor = settings.awayColor || '#1B449C';
    document.querySelector('#scorebug-tab .team.home').style.backgroundColor = settings.teamBackground || '#34003a';
    document.querySelector('#scorebug-tab .team.away').style.backgroundColor = settings.teamBackground || '#34003a';
    document.querySelector('#scorebug-tab .goals').style.backgroundColor = settings.goalsBackground || '#00fc8a';
    document.querySelector('#scorebug-tab .time').style.backgroundColor = settings.timeBackground || '#ffffff';
    document.querySelector('#scorebug-tab .team.home .name').style.color = settings.teamTextColor || '#ffffff';
    document.querySelector('#scorebug-tab .team.away .name').style.color = settings.teamTextColor || '#ffffff';
    document.querySelector('#scorebug-tab .goals').style.color = settings.goalsTextColor || '#34003a';
    document.querySelector('#scorebug-tab .time').style.color = settings.timeTextColor || '#34003a';

    homeScore = settings.homeScore || 0;
    awayScore = settings.awayScore || 0;
    document.getElementById('home-score').textContent = homeScore;
    document.getElementById('away-score').textContent = awayScore;

    document.getElementById('timer-display').textContent = `${settings.minute || '00'}:${settings.second || '00'}`;
    document.getElementById('preview-team-name').textContent = settings.homeName || 'GOSPODARZE';

    adjustPreviewTeamWidths();
  } catch (error) {
    console.error('Błąd ładowania ustawień:', error);
  }
}

async function loadPlayers() {
  try {
    const response = await fetch('/players-data');
    const data = await response.json();

    const homeList = document.getElementById('home-players-list');
    const awayList = document.getElementById('away-players-list');

    data.home.forEach(player => {
      const div = document.createElement('div');
      div.className = 'player-item bg-gray-700 p-2 rounded-lg cursor-pointer';
      div.dataset.team = 'home';
      div.dataset.number = player.number;
      div.dataset.name = player.name;
      div.innerHTML = `<span class="font-bold">${player.number}</span> ${player.name} (${player.position})`;
      div.onclick = () => togglePlayerSelection(div, player);
      homeList.appendChild(div);
    });

    data.away.forEach(player => {
      const div = document.createElement('div');
      div.className = 'player-item bg-gray-700 p-2 rounded-lg cursor-pointer';
      div.dataset.team = 'away';
      div.dataset.number = player.number;
      div.dataset.name = player.name;
      div.innerHTML = `<span class="font-bold">${player.number}</span> ${player.name} (${player.position})`;
      div.onclick = () => togglePlayerSelection(div, player);
      awayList.appendChild(div);
    });
  } catch (error) {
    console.error('Błąd ładowania zawodników:', error);
  }
}

function togglePlayerSelection(div, player) {
  const maxSelection = notificationType === 'change' ? 2 : 1;
  if (div.classList.contains('selected')) {
    div.classList.remove('selected');
    selectedPlayers = selectedPlayers.filter(p => p.number !== player.number || p.team !== div.dataset.team);
  } else if (selectedPlayers.length < maxSelection) {
    div.classList.add('selected');
    selectedPlayers.push({ ...player, team: div.dataset.team });
  } else {
    alert(`Możesz wybrać maksymalnie ${maxSelection} zawodników dla tego typu powiadomienia.`);
    return;
  }
  updateNotificationPreview(notificationType);
}

async function updateNotificationPreview(type) {
  notificationType = type;
  notificationTeam = selectedPlayers.length > 0 ? selectedPlayers[0].team : 'home';

  const preview = document.getElementById('notification-preview');
  const previewMessage = document.getElementById('notification-preview-message');
  const changeLabel = document.getElementById('preview-change-label');
  const playerOut = preview.querySelector('.player.out');
  const playerIn = preview.querySelector('.player.in');

  // Sprawdzamy, czy wybrano odpowiednią liczbę zawodników
  const requiredPlayers = notificationType === 'change' ? 2 : 1;
  if (selectedPlayers.length < requiredPlayers) {
    preview.classList.add('hidden');
    previewMessage.classList.remove('hidden');
    return;
  }

  // Pokazujemy podgląd, jeśli wybrano odpowiednią liczbę zawodników
  preview.classList.remove('hidden');
  previewMessage.classList.add('hidden');

  changeLabel.textContent = 
    type === 'change' ? 'Zmiana' :
    type === 'yellow-card' ? 'Żółta Kartka' :
    type === 'red-card' ? 'Czerwona Kartka' :
    type === 'injury' ? 'Kontuzja' : 'Gol';

  // Wyświetlamy tylko nazwisko
  const outSurname = selectedPlayers[0].name.split(' ').pop();
  playerOut.innerHTML = `
    <span class="number">${selectedPlayers[0].number}</span>
    <span class="name">${outSurname}</span>
    ${type === 'change' ? '<span class="arrow">➡️</span>' :
     type === 'yellow-card' ? '<span class="indicator yellow-card"></span>' :
     type === 'red-card' ? '<span class="indicator red-card"></span>' :
     type === 'injury' ? '<span class="indicator injury">➕</span>' :
     '<span class="indicator goal">⚽</span>'}
  `;

  if (type === 'change' && selectedPlayers.length > 1) {
    playerIn.style.display = 'flex';
    const inSurname = selectedPlayers[1].name.split(' ').pop();
    playerIn.innerHTML = `
      <span class="number">${selectedPlayers[1].number}</span>
      <span class="name">${inSurname}</span>
      <span class="arrow">⬅️</span>
    `;
    preview.querySelector('.player-list').classList.remove('one-player');
    preview.querySelector('.player-list').classList.add('two-players');
  } else {
    playerIn.style.display = 'none';
    preview.querySelector('.player-list').classList.remove('two-players');
    preview.querySelector('.player-list').classList.add('one-player');
  }

  // Aktualizacja kolorów i nazwy drużyny w podglądzie
  fetch('/initial-settings')
    .then(response => response.json())
    .then(data => {
      document.getElementById('preview-team-name').textContent = notificationTeam === 'home' ? data.homeName : data.awayName;
      document.querySelector('#notification-preview .team-header .color').style.backgroundColor = notificationTeam === 'home' ? data.homeColor : data.awayColor;
      document.querySelector('#notification-preview .team-header').style.backgroundColor = data.teamBackground;
      document.querySelector('#notification-preview .team-header .name').style.color = data.teamTextColor;
      document.querySelector('#notification-preview .change-header').style.backgroundColor = data.goalsBackground;
      document.querySelector('#notification-preview .change-header').style.color = data.goalsTextColor;
      document.querySelector('#notification-preview .player.out').style.backgroundColor = data.teamBackground;
      document.querySelector('#notification-preview .player.out').style.color = data.teamTextColor;
      if (type === 'change' && selectedPlayers.length > 1) {
        document.querySelector('#notification-preview .player.in').style.backgroundColor = data.teamTextColor;
        document.querySelector('#notification-preview .player.in').style.color = data.teamBackground;
      }
    });
}

async function sendNotification() {
  if (notificationType === 'change' && selectedPlayers.length !== 2) {
    alert('Proszę wybrać dwóch zawodników dla powiadomienia o zmianie.');
    return;
  }
  if (notificationType !== 'change' && selectedPlayers.length !== 1) {
    alert('Proszę wybrać jednego zawodnika dla tego powiadomienia.');
    return;
  }

  const data = {
    type: notificationType,
    team: notificationTeam,
    playerOut: selectedPlayers[0],
    playerIn: notificationType === 'change' ? selectedPlayers[1] : null,
    timestamp: Date.now() // Dodajemy timestamp do danych
  };

  try {
    await fetch('/update-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('Powiadomienie wysłane');
  } catch (error) {
    console.error('Błąd wysyłania powiadomienia:', error);
  }
}

setInterval(async () => {
  try {
    const response = await fetch('/initial-settings');
    const settings = await response.json();
    document.getElementById('timer-display').textContent = `${settings.minute || '00'}:${settings.second || '00'}`;
    document.getElementById('preview-minute').textContent = settings.minute || '00';
    document.getElementById('preview-second').textContent = settings.second || '00';
  } catch (error) {
    console.error('Błąd aktualizacji czasu:', error);
  }
}, 1000);

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.toggle('active', tab.id === `${tabName}-tab`);
  });
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.textContent.toLowerCase().includes(tabName));
  });
}

async function startStream() {
  try {
    await obs.send('StartStreaming');
  } catch (error) {
    console.error('Błąd uruchamiania streamu:', error);
  }
}

async function stopStream() {
  try {
    await obs.send('StopStreaming');
  } catch (error) {
    console.error('Błąd zatrzymywania streamu:', error);
  }
}

async function startTimer() {
  try {
    await fetch('/update-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
  } catch (error) {
    console.error('Błąd uruchamiania timera:', error);
  }
}

async function pauseTimer() {
  try {
    await fetch('/update-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause' })
    });
  } catch (error) {
    console.error('Błąd zatrzymywania timera:', error);
  }
}

async function resetTimer() {
  try {
    await fetch('/update-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' })
    });
  } catch (error) {
    console.error('Błąd resetowania timera:', error);
  }
}

async function setTimerTo45() {
  try {
    await fetch('/update-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set45' })
    });
  } catch (error) {
    console.error('Błąd ustawiania timera na 45:00:', error);
  }
}

async function setTimerToZero() {
  try {
    await fetch('/update-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setZero' })
    });
  } catch (error) {
    console.error('Błąd ustawiania timera na 00:00:', error);
  }
}

function updateScore(team, delta) {
  if (team === 'home') {
    homeScore += delta;
    if (homeScore < 0) homeScore = 0;
    document.getElementById('home-score').textContent = homeScore;
    document.getElementById('preview-home-score').textContent = homeScore;

    fetch('/update-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeScore: homeScore })
    });
  } else if (team === 'away') {
    awayScore += delta;
    if (awayScore < 0) awayScore = 0;
    document.getElementById('away-score').textContent = awayScore;
    document.getElementById('preview-away-score').textContent = awayScore;

    fetch('/update-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awayScore: awayScore })
    });
  }
}

function adjustPreviewTeamWidths() {
  const homeName = document.getElementById('preview-home-name').textContent;
  const awayName = document.getElementById('preview-away-name').textContent;
  const homeTeam = document.querySelector('#scorebug-tab .team.home');
  const awayTeam = document.querySelector('#scorebug-tab .team.away');

  const minWidth = 102;
  const charWidth = 14;

  const homeWidth = Math.max(minWidth, homeName.length * charWidth + 12);
  const awayWidth = Math.max(minWidth, awayName.length * charWidth + 12);

  homeTeam.style.width = `${homeWidth}px`;
  awayTeam.style.width = `${awayWidth}px`;
}

document.getElementById('home-team-name').addEventListener('input', function() {
  document.getElementById('preview-home-name').textContent = this.value;
  adjustPreviewTeamWidths();
});

document.getElementById('away-team-name').addEventListener('input', function() {
  document.getElementById('preview-away-name').textContent = this.value;
  adjustPreviewTeamWidths();
});

document.getElementById('home-team-color').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .team.home .color').style.backgroundColor = this.value;
  document.getElementById('home-hex').textContent = this.value;
});

document.getElementById('away-team-color').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .team.away .color').style.backgroundColor = this.value;
  document.getElementById('away-hex').textContent = this.value;
});

document.getElementById('team-background').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .team.home').style.backgroundColor = this.value;
  document.querySelector('#scorebug-tab .team.away').style.backgroundColor = this.value;
  document.getElementById('team-background-hex').textContent = this.value;
});

document.getElementById('goals-background').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .goals').style.backgroundColor = this.value;
  document.getElementById('goals-background-hex').textContent = this.value;
});

document.getElementById('time-background').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .time').style.backgroundColor = this.value;
  document.getElementById('time-background-hex').textContent = this.value;
});

document.getElementById('team-text-color').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .team.home .name').style.color = this.value;
  document.querySelector('#scorebug-tab .team.away .name').style.color = this.value;
  document.getElementById('team-text-color-hex').textContent = this.value;
});

document.getElementById('goals-text-color').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .goals').style.color = this.value;
  document.getElementById('goals-text-color-hex').textContent = this.value;
});

document.getElementById('time-text-color').addEventListener('input', function() {
  document.querySelector('#scorebug-tab .time').style.color = this.value;
  document.getElementById('time-text-color-hex').textContent = this.value;
});

document.getElementById('home-score-bug').addEventListener('input', function() {
  document.getElementById('preview-home-score').textContent = this.value;
});

document.getElementById('away-score-bug').addEventListener('input', function() {
  document.getElementById('preview-away-score').textContent = this.value;
});

document.getElementById('match-minute').addEventListener('input', function() {
  document.getElementById('preview-minute').textContent = pad(parseInt(this.value) || 0);
});

document.getElementById('match-second').addEventListener('input', function() {
  document.getElementById('preview-second').textContent = pad(parseInt(this.value) || 0);
});

document.getElementById('update-scorebug').addEventListener('click', async function() {
  const data = {
    homeName: document.getElementById('home-team-name').value,
    awayName: document.getElementById('away-team-name').value,
    homeScore: parseInt(document.getElementById('home-score-bug').value) || 0,
    awayScore: parseInt(document.getElementById('away-score-bug').value) || 0,
    minute: pad(parseInt(document.getElementById('match-minute').value) || 0),
    second: pad(parseInt(document.getElementById('match-second').value) || 0),
    homeColor: document.getElementById('home-team-color').value,
    awayColor: document.getElementById('away-team-color').value,
    teamBackground: document.getElementById('team-background').value,
    goalsBackground: document.getElementById('goals-background').value,
    timeBackground: document.getElementById('time-background').value,
    teamTextColor: document.getElementById('team-text-color').value,
    goalsTextColor: document.getElementById('goals-text-color').value,
    timeTextColor: document.getElementById('time-text-color').value
  };

  homeScore = data.homeScore;
  awayScore = data.awayScore;
  document.getElementById('home-score').textContent = homeScore;
  document.getElementById('away-score').textContent = awayScore;

  try {
    await fetch('/update-scorebug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('Scorebug zaktualizowany');
  } catch (error) {
    console.error('Błąd aktualizacji scorebug:', error);
  }

  adjustPreviewTeamWidths();
});

async function switchScene(sceneName) {
  try {
    await obs.send('SetCurrentScene', { 'scene-name': sceneName });
    console.log(`Przełączono na scenę: ${sceneName}`);
  } catch (error) {
    console.error(`Błąd przełączania sceny ${sceneName}:`, error);
  }
}

function pad(number) {
  return number.toString().padStart(2, '0');
}

loadInitialSettings();
loadPlayers();