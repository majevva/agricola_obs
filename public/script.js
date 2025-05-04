let homeScore = 0;
let awayScore = 0;
let selectedPlayers = [];
let notificationType = 'change';
let notificationTeam = 'home';

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
    
    // Dodaj wywołanie funkcji sprawdzającej stan timera
    await checkTimerState();
  } catch (error) {
    console.error('Błąd ładowania ustawień:', error);
  }
}

async function checkStreamStatus() {
  try {
    const response = await fetch('/stream-status');
    const data = await response.json();
    if (data.streaming) {
      document.getElementById('stream-status').textContent = 'ON';
      document.getElementById('stream-status').classList.remove('status-off');
      document.getElementById('stream-status').classList.add('status-on');
      document.querySelector('.status-item i').classList.remove('text-red-500');
      document.querySelector('.status-item i').classList.add('text-green-500');
    } else {
      document.getElementById('stream-status').textContent = 'OFF';
      document.getElementById('stream-status').classList.remove('status-on');
      document.getElementById('stream-status').classList.add('status-off');
      document.querySelector('.status-item i').classList.remove('text-green-500');
      document.querySelector('.status-item i').classList.add('text-red-500');
    }
  } catch (error) {
    console.error('Błąd sprawdzania statusu streamu:', error);
  }
}

// Sprawdzaj status streamu co 5 sekund
setInterval(checkStreamStatus, 5000);
checkStreamStatus();

async function loadPlayers() {
  try {
    const response = await fetch('/players-data');
    if (!response.ok) {
      throw new Error(`Błąd HTTP: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    if (!data.home || !data.away) {
      throw new Error('Brak danych drużyn w odpowiedzi serwera');
    }

    // Sortowanie zawodników po nazwisku (lastname)
    data.home.sort((a, b) => a.lastname.localeCompare(b.lastname));
    data.away.sort((a, b) => a.lastname.localeCompare(b.lastname));

    const homeList = document.getElementById('home-players-list');
    const awayList = document.getElementById('away-players-list');

    homeList.innerHTML = '';
    awayList.innerHTML = '';

    data.home.forEach(player => {
      const div = document.createElement('div');
      div.className = 'player-item bg-gray-700 p-2 rounded-lg cursor-pointer hover:bg-gray-600 transition';
      div.dataset.team = 'home';
      div.textContent = `${player.lastname} ${player.firstname}`;
      div.onclick = () => togglePlayerSelection(div, player);
      homeList.appendChild(div);
    });

    data.away.forEach(player => {
      const div = document.createElement('div');
      div.className = 'player-item bg-gray-700 p-2 rounded-lg cursor-pointer hover:bg-gray-600 transition';
      div.dataset.team = 'away';
      div.textContent = `${player.lastname} ${player.firstname}`;
      div.onclick = () => togglePlayerSelection(div, player);
      awayList.appendChild(div);
    });
  } catch (error) {
    console.error('Błąd ładowania zawodników:', error);
    const homeList = document.getElementById('home-players-list');
    const awayList = document.getElementById('away-players-list');
    homeList.innerHTML = '<p class="text-red-500">Błąd ładowania zawodników gospodarzy.</p>';
    awayList.innerHTML = '<p class="text-red-500">Błąd ładowania zawodników gości.</p>';
  }
}

function togglePlayerSelection(div, player) {
  console.log("Toggling player selection:", player);
  
  if (div.classList.contains('selected')) {
    // If clicking already selected player, deselect it
    div.classList.remove('selected');
    selectedPlayers = selectedPlayers.filter(p => 
      p.number !== player.number || p.team !== div.dataset.team
    );
  } else {
    if (notificationType === 'change' && selectedPlayers.length > 0) {
      const firstPlayerTeam = selectedPlayers[0].team;
      if (firstPlayerTeam !== div.dataset.team) {
        alert('Przy zmianie zawodnicy muszą być z tej samej drużyny!');
        return;
      }
      
      if (selectedPlayers.length >= 2) {
        // Jeśli już mamy 2 zawodników, usuń pierwszego
        const firstSelected = document.querySelector('.player-item.selected');
        if (firstSelected) {
          firstSelected.classList.remove('selected');
          selectedPlayers.shift();
        }
      }
    } else if (notificationType !== 'change' && selectedPlayers.length >= 1) {
      // Jeśli to nie jest zmiana i już mamy jednego zawodnika, usuń go
      const previouslySelected = document.querySelector('.player-item.selected');
      if (previouslySelected) {
        previouslySelected.classList.remove('selected');
        selectedPlayers = [];
      }
    }

    div.classList.add('selected');
    selectedPlayers.push({ ...player, team: div.dataset.team });
  }
  
  console.log("Selected players:", selectedPlayers);
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

  const requiredPlayers = notificationType === 'change' ? 2 : 1;
  if (selectedPlayers.length < requiredPlayers) {
    preview.classList.add('hidden');
    previewMessage.classList.remove('hidden');
    return;
  }

  preview.classList.remove('hidden');
  previewMessage.classList.add('hidden');

  changeLabel.textContent = 
    type === 'change' ? 'Zmiana' :
    type === 'yellow-card' ? 'Żółta Kartka' :
    type === 'red-card' ? 'Czerwona Kartka' :
    type === 'injury' ? 'Kontuzja' : 'Gol';

  const outSurname = selectedPlayers[0].lastname;
  playerOut.innerHTML = `
    <span class="name">${outSurname}</span>
    ${type === 'change' ? '<span class="arrow">➡️</span>' :
     type === 'yellow-card' ? '<span class="indicator yellow-card"></span>' :
     type === 'red-card' ? '<span class="indicator red-card"></span>' :
     type === 'injury' ? '<span class="indicator injury">🩹</span>' :
     '<span class="indicator goal">⚽</span>'}
  `;

  if (type === 'change' && selectedPlayers.length > 1) {
    playerIn.style.display = 'flex';
    const inSurname = selectedPlayers[1].lastname;
    playerIn.innerHTML = `
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
    timestamp: Date.now()
  };

  console.log('Wysyłanie powiadomienia z danymi:', data);

  try {
    const response = await fetch('/update-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`Błąd HTTP: ${response.status} ${response.statusText}`);
    }
    console.log('Powiadomienie wysłane pomyślnie');
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
    await fetch('/start-stream', { method: 'POST' });
    console.log('Stream uruchomiony');
  } catch (error) {
    console.error('Błąd uruchamiania streamu:', error);
  }
}

async function stopStream() {
  try {
    await fetch('/stop-stream', { method: 'POST' });
    console.log('Stream zatrzymany');
  } catch (error) {
    console.error('Błąd zatrzymywania streamu:', error);
  }
}

async function switchScene(sceneName) {
  try {
    await fetch('/switch-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneName })
    });
    console.log(`Przełączono na scenę: ${sceneName}`);
  } catch (error) {
    console.error(`Błąd przełączania sceny ${sceneName}:`, error);
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

function pad(number) {
  return number.toString().padStart(2, '0');
}

// Zmienna globalna do śledzenia stanu timera
let isTimerRunning = false;

/**
 * Toggle timer between running and paused states
 */
async function toggleTimer() {
  if (isTimerRunning) {
    await pauseTimer();
    isTimerRunning = false;
    updateTimerToggleButton(false);
  } else {
    await startTimer();
    isTimerRunning = true;
    updateTimerToggleButton(true);
  }
}

/**
 * Update timer toggle button appearance
 * @param {boolean} running - Whether timer is running
 */
function updateTimerToggleButton(running) {
  const button = document.getElementById('timer-toggle-btn');
  const icon = document.getElementById('timer-toggle-icon');
  const text = document.getElementById('timer-toggle-text');
  
  if (!button || !icon || !text) return;
  
  if (running) {
    button.classList.remove('bg-blue-600');
    button.classList.add('bg-yellow-600', 'running');
    icon.classList.remove('fa-play');
    icon.classList.add('fa-pause');
    text.textContent = 'PAUZA';
  } else {
    button.classList.remove('bg-yellow-600', 'running');
    button.classList.add('bg-blue-600');
    icon.classList.remove('fa-pause');
    icon.classList.add('fa-play');
    text.textContent = 'START';
  }
}

// Zmienna globalna do śledzenia stanu mikrofonu
let isMicMuted = true; // Domyślnie mikrofon wyciszony

/**
 * Toggle microphone mute state
 */
async function toggleMic() {
  try {
    const newState = !isMicMuted;
    const response = await fetch('/toggle-mic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mute: newState })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    isMicMuted = data.muted;
    updateMicButton();
    
    console.log(`Mikrofon ${isMicMuted ? 'wyciszony' : 'włączony'}`);
  } catch (error) {
    console.error('Błąd przełączania mikrofonu:', error);
  }
}

/**
 * Update microphone button appearance based on mute state
 */
function updateMicButton() {
  const micButton = document.getElementById('mic-toggle');
  const micIcon = document.getElementById('mic-icon');
  const micText = document.getElementById('mic-text');
  
  if (!micButton || !micIcon || !micText) return;
  
  if (isMicMuted) {
    micButton.classList.add('muted');
    micButton.classList.add('bg-red-600');
    micButton.classList.remove('bg-green-600');
    micIcon.classList.remove('fa-microphone');
    micIcon.classList.add('fa-microphone-slash');
    micText.textContent = 'MIKROFON WYCISZONY';
  } else {
    micButton.classList.remove('muted');
    micButton.classList.remove('bg-red-600');
    micButton.classList.add('bg-green-600');
    micIcon.classList.remove('fa-microphone-slash');
    micIcon.classList.add('fa-microphone');
    micText.textContent = 'MIKROFON AKTYWNY';
  }
}

// Funkcja do edycji timera bezpośrednio w miejscu
function setupTimerEdit() {
  const timerDisplay = document.getElementById('timer-display');
  const timerEditToggle = document.getElementById('timer-edit');
  
  if (!timerDisplay || !timerEditToggle) return;
  
  timerEditToggle.addEventListener('click', function() {
    // Pobierz aktualny czas
    const currentTime = timerDisplay.textContent.trim();
    
    // Utwórz pole edycji zachowując styl timera
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTime;
    input.className = 'timer-display'; // Zachowaj ten sam styl
    input.style.width = '100%';
    input.style.textAlign = 'center';
    input.style.border = '2px solid #6b46c1';
    input.style.outline = 'none';
    input.style.background = 'transparent';
    
    // Zastąp wyświetlacz polem edycji
    timerDisplay.style.display = 'none';
    timerDisplay.parentNode.insertBefore(input, timerDisplay);
    
    // Ustaw fokus i zaznacz tekst
    input.focus();
    input.select();
    
    // Flaga do śledzenia, czy input został już usunięty
    let inputRemoved = false;
    
    // Funkcja do usuwania inputa i przywracania wyświetlacza
    function cleanupInput() {
      if (!inputRemoved) {
        inputRemoved = true;
        input.remove();
        timerDisplay.style.display = '';
      }
    }
    
    // Obsługa zatwierdzenia (Enter) lub anulowania (Escape)
    input.addEventListener('keydown', async function(event) {
      if (event.key === 'Enter') {
        const newTime = input.value.trim();
        
        // Sprawdź, czy format czasu jest poprawny (MM:SS)
        if (/^\d{1,2}:\d{2}$/.test(newTime)) {
          // Aktualizuj wyświetlacz timera
          timerDisplay.textContent = newTime;
          
          // Wyślij nowy czas do serwera
          try {
            const parts = newTime.split(':');
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            
            await fetch('/update-time', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'set',
                minute: pad(minutes),
                second: pad(seconds)
              })
            });
          } catch (error) {
            console.error('Błąd aktualizacji timera:', error);
          }
          
          // Usuń pole edycji
          cleanupInput();
        } else {
          // Wyświetl komunikat o błędzie
          alert('Wprowadź czas w formacie MM:SS (np. 05:30)');
          input.focus();
          input.select();
        }
      } else if (event.key === 'Escape') {
        // Anuluj edycję
        cleanupInput();
      }
    });
    
    // Obsługa utraty fokusu
    input.addEventListener('blur', function() {
      // Anuluj edycję przy utracie fokusu
      // Używamy setTimeout, aby dać zdarzeniu keydown szansę na wykonanie się pierwsze
      setTimeout(cleanupInput, 100);
    });
  });
}

// Wywołaj funkcję po załadowaniu strony
window.addEventListener('load', function() {
  setupTimerEdit();
});

// Dodaj tę funkcję do istniejącego kodu JavaScript
function updateNotificationInstructions(type) {
  const instructionsElement = document.getElementById('notification-instructions');
  
  // Aktualizuj instrukcje w zależności od typu powiadomienia
  if (type === 'change') {
    instructionsElement.textContent = 'Wybierz dwóch zawodników z tej samej drużyny - pierwszy wychodzi, drugi wchodzi.';
  } else if (type === 'yellow-card') {
    instructionsElement.textContent = 'Wybierz zawodnika, który otrzymał żółtą kartkę.';
  } else if (type === 'red-card') {
    instructionsElement.textContent = 'Wybierz zawodnika, który otrzymał czerwoną kartkę.';
  } else if (type === 'injury') {
    instructionsElement.textContent = 'Wybierz kontuzjowanego zawodnika.';
  } else if (type === 'goal') {
    instructionsElement.textContent = 'Wybierz zawodnika, który strzelił gola.';
  }
  
  // Wyczyść zaznaczenie zawodników przy zmianie typu powiadomienia
  clearPlayerSelection();
}

// Funkcja do czyszczenia zaznaczenia zawodników
function clearPlayerSelection() {
  const selectedPlayers = document.querySelectorAll('.player-item.selected');
  selectedPlayers.forEach(player => {
    player.classList.remove('selected');
  });
  
  // Wyczyść tablicę wybranych zawodników
  selectedPlayers = [];
}

// Dodaj tę funkcję do inicjalizacji przycisków typów powiadomień
function initNotificationButtons() {
  const buttons = document.querySelectorAll('.notification-type-btn');
  
  buttons.forEach(button => {
    button.addEventListener('click', function() {
      // Usuń klasę active ze wszystkich przycisków
      buttons.forEach(btn => btn.classList.remove('active'));
      
      // Dodaj klasę active do klikniętego przycisku
      this.classList.add('active');
      
      // Pobierz typ powiadomienia z atrybutu data-type
      const type = this.getAttribute('data-type');
      
      // Aktualizuj instrukcje
      updateNotificationInstructions(type);
      
      // Aktualizuj podgląd powiadomienia
      updateNotificationPreview(type);
    });
  });
  
  // Domyślnie wybierz pierwszy typ powiadomienia (zmiana)
  const defaultButton = document.querySelector('.notification-type-btn[data-type="change"]');
  if (defaultButton) {
    defaultButton.classList.add('active');
    updateNotificationInstructions('change');
  }
}

// Wywołaj tę funkcję po załadowaniu strony
window.addEventListener('load', function() {
  setupTimerEdit();
  loadInitialSettings();
  loadPlayers();
  updateMicButton();
  initNotificationButtons(); // Dodaj to wywołanie
});