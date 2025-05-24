// --- GLOBALNE ZMIENNE ---
let homeScore = 0;
let awayScore = 0;
let selectedPlayers = [];
let notificationType = 'change';
let notificationTeam = 'home';
let allPlayers = [];
let recentActivities = [];
let quickSendBtn, quickChangeSelect, quickChangePlayerIn, quickModal, quickPlayerInfo;
let playerSearch, playerSuggestions;
let repeatModal, repeatInfo, repeatBtn, repeatNewBtn;
let repeatActivity = null;
let quickSelectedPlayer = null;
let quickSelectedType = null;
let quickSelectedPlayerIn = null;
let isTimerRunning = false;
let isMicMuted = true;

// --- FUNKCJE POMOCNICZE ---
function normalizeString(str) {
  return str
    ? str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ł/g, 'l')
        .replace(/Ł/g, 'L')
    : '';
}

function pad(number) {
  return number.toString().padStart(2, '0');
}

function formatMinute(ts) {
  const date = new Date(ts);
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// --- RECENT ACTIVITIES ---
function addRecentActivity(activity) {
  recentActivities.unshift(activity);
  if (recentActivities.length > 8) recentActivities.length = 8;
  renderRecentActivities();
}

function renderRecentActivities() {
  const list = document.getElementById('recent-activities-list');
  if (!list) return;
  list.innerHTML = '';
  recentActivities.forEach((act) => {
    const div = document.createElement('div');
    div.className = 'bg-gray-700 hover:bg-purple-700 cursor-pointer rounded px-3 py-2 flex items-center justify-between';
    let label = `${act.playerOut.lastname} ${act.playerOut.firstname}`;
    if (act.type === 'goal') label += ' → Gol';
    else if (act.type === 'yellow-card') label += ' → Żółta kartka';
    else if (act.type === 'red-card') label += ' → Czerwona kartka';
    else if (act.type === 'injury') label += ' → Kontuzja';
    else if (act.type === 'change' && act.playerIn) label += ` → Zmiana (${act.playerIn.lastname} ${act.playerIn.firstname})`;
    if (act.timestamp) label += ` (${formatMinute(act.timestamp)})`;
    div.textContent = label;
    div.onclick = () => showRepeatActivityModal(act);
    list.appendChild(div);
  });
  localStorage.setItem('recentActivities', JSON.stringify(recentActivities));
}

// --- SZYBKIE POWIADOMIENIA ---
// Dodaj tę funkcję jeśli jej nie ma!
function setupQuickNotificationEvents() {
  document.querySelectorAll('.quick-notif-btn').forEach(btn => {
    btn.onclick = function() {
      quickSelectedType = this.getAttribute('data-type');
      if (quickSelectedType === 'change') {
        const options = allPlayers.filter(p => p.team === quickSelectedPlayer.team && p.number !== quickSelectedPlayer.number)
          .map(p => `<option value="${p.number}">${p.lastname} ${p.firstname}</option>`);
        quickChangePlayerIn.innerHTML = options.join('');
        quickChangeSelect.classList.remove('hidden');
        quickSendBtn.disabled = false;
        quickSendBtn.textContent = 'Wyślij na ekran';
      } else {
        quickChangeSelect.classList.add('hidden');
        quickSendBtn.disabled = false;
        quickSendBtn.textContent = 'Wyślij na ekran';
      }
    };
  });
  if (quickChangePlayerIn) {
    quickChangePlayerIn.onchange = function() {
      quickSelectedPlayerIn = allPlayers.find(p =>
        p.team === quickSelectedPlayer.team && p.number == this.value
      );
    };
  }
  if (quickSendBtn) {
    quickSendBtn.onclick = async function() {
      if (!quickSelectedPlayer || !quickSelectedType) return;
      let data = {
        type: quickSelectedType,
        team: quickSelectedPlayer.team,
        playerOut: quickSelectedPlayer,
        playerIn: quickSelectedType === 'change' ? (
          quickSelectedPlayerIn ||
          allPlayers.find(p => p.team === quickSelectedPlayer.team && p.number == quickChangePlayerIn.value)
        ) : null,
        timestamp: Date.now()
      };
      try {
        await fetch('/update-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        closeQuickNotificationModal();
        addRecentActivity(data);
      } catch (e) {
        alert('Błąd wysyłania powiadomienia!');
      }
    };
  }
}

// --- MODALE POWTÓRZENIA I SZYBKIEGO POWIADOMIENIA ---
function showRepeatActivityModal(activity) {
  repeatActivity = activity;
  let label = `<div class="font-bold text-lg mb-2">${activity.playerOut.lastname} ${activity.playerOut.firstname}</div>`;
  if (activity.type === 'goal') label += '<div class="mb-2">Ostatnia aktywność: <span class="text-green-400">Gol</span></div>';
  else if (activity.type === 'yellow-card') label += '<div class="mb-2">Ostatnia aktywność: <span class="text-yellow-400">Żółta kartka</span></div>';
  else if (activity.type === 'red-card') label += '<div class="mb-2">Ostatnia aktywność: <span class="text-red-400">Czerwona kartka</span></div>';
  else if (activity.type === 'injury') label += '<div class="mb-2">Ostatnia aktywność: <span class="text-gray-300">Kontuzja</span></div>';
  else if (activity.type === 'change' && activity.playerIn) label += `<div class="mb-2">Ostatnia aktywność: <span class="text-blue-400">Zmiana (${activity.playerIn.lastname} ${activity.playerIn.firstname})</span></div>`;
  if (activity.timestamp) label += `<div class="text-xs text-gray-400">Godzina: ${formatMinute(activity.timestamp)}</div>`;
  repeatInfo.innerHTML = label;
  repeatModal.classList.remove('hidden');
}

function closeRepeatActivityModal() {
  repeatModal.classList.add('hidden');
  repeatActivity = null;
}

if (repeatBtn) {
  repeatBtn.onclick = async function() {
    if (!repeatActivity) return;
    // Wyślij powtórkę powiadomienia (zaktualizuj timestamp)
    const data = { ...repeatActivity, timestamp: Date.now() };
    try {
      await fetch('/update-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      closeRepeatActivityModal();
      addRecentActivity(data);
    } catch (e) {
      alert('Błąd wysyłania powiadomienia!');
    }
  };
}
if (repeatNewBtn) {
  repeatNewBtn.onclick = function() {
    closeRepeatActivityModal();
    // Otwórz szybkie powiadomienie z tym zawodnikiem
    quickSelectedPlayer = repeatActivity.playerOut;
    showQuickNotificationModal(quickSelectedPlayer);
  };
}

// --- Modyfikacja quickSendBtn, aby zapisywać aktywność ---
if (quickSendBtn) {
  quickSendBtn.onclick = async function() {
    if (!quickSelectedPlayer || !quickSelectedType) return;
    let data = {
      type: quickSelectedType,
      team: quickSelectedPlayer.team,
      playerOut: quickSelectedPlayer,
      playerIn: quickSelectedType === 'change' ? (
        quickSelectedPlayerIn ||
        allPlayers.find(p => p.team === quickSelectedPlayer.team && p.number == quickChangePlayerIn.value)
      ) : null,
      timestamp: Date.now()
    };
    try {
      await fetch('/update-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      closeQuickNotificationModal();
      addRecentActivity(data); // Dodaj do historii
    } catch (e) {
      alert('Błąd wysyłania powiadomienia!');
    }
  };
}

// --- Dodaj ładowanie historii z localStorage (opcjonalnie) ---
window.addEventListener('load', function() {
  const stored = localStorage.getItem('recentActivities');
  if (stored) {
    try {
      recentActivities = JSON.parse(stored);
      renderRecentActivities();
    } catch {}
  }
});

// --- Zapisuj historię do localStorage przy każdej zmianie ---
function renderRecentActivities() {
  // ...existing code...
  localStorage.setItem('recentActivities', JSON.stringify(recentActivities));
}

async function loadInitialSettings() {
  try {
    const response = await fetch('/initial-settings');
    const settings = await response.json();

    // Sprawdzaj istnienie elementów przed ustawieniem wartości
    const el = id => document.getElementById(id);

    if (el('home-team-name')) el('home-team-name').value = settings.homeName || 'GOSPODARZE';
    if (el('away-team-name')) el('away-team-name').value = settings.awayName || 'GOŚCIE';
    if (el('home-team-color')) el('home-team-color').value = settings.homeColor || '#C8102E';
    if (el('away-team-color')) el('away-team-color').value = settings.awayColor || '#1B449C';
    if (el('home-hex')) el('home-hex').textContent = settings.homeColor || '#C8102E';
    if (el('away-hex')) el('away-hex').textContent = settings.awayColor || '#1B449C';
    if (el('home-score-bug')) el('home-score-bug').value = settings.homeScore || 0;
    if (el('away-score-bug')) el('away-score-bug').value = settings.awayScore || 0;
    if (el('team-background')) el('team-background').value = settings.teamBackground || '#34003a';
    if (el('goals-background')) el('goals-background').value = settings.goalsBackground || '#00fc8a';
    if (el('time-background')) el('time-background').value = settings.timeBackground || '#ffffff';
    if (el('team-background-hex')) el('team-background-hex').textContent = settings.teamBackground || '#34003a';
    if (el('goals-background-hex')) el('goals-background-hex').textContent = settings.goalsBackground || '#00fc8a';
    if (el('time-background-hex')) el('time-background-hex').textContent = settings.timeBackground || '#ffffff';
    if (el('team-text-color')) el('team-text-color').value = settings.teamTextColor || '#ffffff';
    if (el('goals-text-color')) el('goals-text-color').value = settings.goalsTextColor || '#34003a';
    if (el('time-text-color')) el('time-text-color').value = settings.timeTextColor || '#34003a';
    if (el('team-text-color-hex')) el('team-text-color-hex').textContent = settings.teamTextColor || '#ffffff';
    if (el('goals-text-color-hex')) el('goals-text-color-hex').textContent = settings.goalsTextColor || '#34003a';
    if (el('time-text-color-hex')) el('time-text-color-hex').textContent = settings.timeTextColor || '#34003a';

    if (el('preview-home-name')) el('preview-home-name').textContent = settings.homeName || 'GOSPODARZE';
    if (el('preview-away-name')) el('preview-away-name').textContent = settings.awayName || 'GOŚCIE';
    if (el('preview-home-score')) el('preview-home-score').textContent = settings.homeScore || 0;
    if (el('preview-away-score')) el('preview-away-score').textContent = settings.awayScore || 0;
    if (el('preview-minute')) el('preview-minute').textContent = settings.minute || '00';
    if (el('preview-second')) el('preview-second').textContent = settings.second || '00';

    // Sprawdzaj istnienie elementów przed użyciem querySelector
    const scorebugTab = document.getElementById('scorebug-tab');
    if (scorebugTab) {
      const homeColor = scorebugTab.querySelector('.team.home .color');
      if (homeColor) homeColor.style.backgroundColor = settings.homeColor || '#C8102E';
      const awayColor = scorebugTab.querySelector('.team.away .color');
      if (awayColor) awayColor.style.backgroundColor = settings.awayColor || '#1B449C';
      const homeTeam = scorebugTab.querySelector('.team.home');
      if (homeTeam) homeTeam.style.backgroundColor = settings.teamBackground || '#34003a';
      const awayTeam = scorebugTab.querySelector('.team.away');
      if (awayTeam) awayTeam.style.backgroundColor = settings.teamBackground || '#34003a';
      const goals = scorebugTab.querySelector('.goals');
      if (goals) goals.style.backgroundColor = settings.goalsBackground || '#00fc8a';
      const time = scorebugTab.querySelector('.time');
      if (time) time.style.backgroundColor = settings.timeBackground || '#ffffff';
      const homeName = scorebugTab.querySelector('.team.home .name');
      if (homeName) homeName.style.color = settings.teamTextColor || '#ffffff';
      const awayName = scorebugTab.querySelector('.team.away .name');
      if (awayName) awayName.style.color = settings.teamTextColor || '#ffffff';
      if (goals) goals.style.color = settings.goalsTextColor || '#34003a';
      if (time) time.style.color = settings.timeTextColor || '#34003a';
    }

    homeScore = settings.homeScore || 0;
    awayScore = settings.awayScore || 0;
    if (el('home-score')) el('home-score').textContent = homeScore;
    if (el('away-score')) el('away-score').textContent = awayScore;

    if (el('timer-display')) el('timer-display').textContent = `${settings.minute || '00'}:${settings.second || '00'}`;
    if (el('preview-team-name')) el('preview-team-name').textContent = settings.homeName || 'GOSPODARZE';

    adjustPreviewTeamWidths();
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

    // Zbierz wszystkich zawodników do szybkiego wyszukiwania
    allPlayers = [
      ...data.home.map(p => ({ ...p, team: 'home' })),
      ...data.away.map(p => ({ ...p, team: 'away' }))
    ];
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
    // Po wysłaniu powiadomienia wyczyść zaznaczenie i podgląd
    clearPlayerSelection();
    selectedPlayers = [];
    updateNotificationPreview(notificationType);
  } catch (error) {
    console.error('Błąd wysyłania powiadomienia:', error);
  }
}

setInterval(async () => {
  try {
    const response = await fetch('/initial-settings');
    const settings = await response.json();
    const timerDisplay = document.getElementById('timer-display');
    const previewMinute = document.getElementById('preview-minute');
    const previewSecond = document.getElementById('preview-second');
    if (timerDisplay) {
      timerDisplay.textContent = `${settings.minute || '00'}:${settings.second || '00'}`;
    }
    if (previewMinute) {
      previewMinute.textContent = settings.minute || '00';
    }
    if (previewSecond) {
      previewSecond.textContent = settings.second || '00';
    }
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
    const homeScoreEl = document.getElementById('home-score');
    const previewHomeScoreEl = document.getElementById('preview-home-score');
    if (homeScoreEl) homeScoreEl.textContent = homeScore;
    if (previewHomeScoreEl) previewHomeScoreEl.textContent = homeScore;

    fetch('/update-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeScore: homeScore })
    });
  } else if (team === 'away') {
    awayScore += delta;
    if (awayScore < 0) awayScore = 0;
    const awayScoreEl = document.getElementById('away-score');
    const previewAwayScoreEl = document.getElementById('preview-away-score');
    if (awayScoreEl) awayScoreEl.textContent = awayScore;
    if (previewAwayScoreEl) previewAwayScoreEl.textContent = awayScore;

    fetch('/update-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awayScore: awayScore })
    });
  }
}

function adjustPreviewTeamWidths() {
  const homeNameEl = document.getElementById('preview-home-name');
  const awayNameEl = document.getElementById('preview-away-name');
  const homeTeam = document.querySelector('#scorebug-tab .team.home');
  const awayTeam = document.querySelector('#scorebug-tab .team.away');

  if (!homeNameEl || !awayNameEl || !homeTeam || !awayTeam) return;

  const homeName = homeNameEl.textContent;
  const awayName = awayNameEl.textContent;

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

document.getElementById('update-scorebug').addEventListener('click', async function() {
  const data = {
    homeName: document.getElementById('home-team-name').value,
    awayName: document.getElementById('away-team-name').value,
    homeScore: parseInt(document.getElementById('home-score-bug').value) || 0,
    awayScore: parseInt(document.getElementById('away-score-bug').value) || 0,
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
  document.querySelectorAll('.player-item.selected').forEach(player => {
    player.classList.remove('selected');
  });
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


window.addEventListener('load', function() {
  // Inicjalizuj DOM elementy po załadowaniu strony
  quickSendBtn = document.getElementById('quick-send-btn');
  quickChangeSelect = document.getElementById('quick-change-select');
  quickChangePlayerIn = document.getElementById('quick-change-player-in');
  quickModal = document.getElementById('quick-notification-modal');
  quickPlayerInfo = document.getElementById('quick-player-info');
  playerSearch = document.getElementById('player-search');
  playerSuggestions = document.getElementById('player-search-suggestions');
  repeatModal = document.getElementById('repeat-activity-modal');
  repeatInfo = document.getElementById('repeat-activity-info');
  repeatBtn = document.getElementById('repeat-activity-btn');
  repeatNewBtn = document.getElementById('repeat-activity-new-btn');

  // ...pozostałe wywołania funkcji inicjalizujących...
  setupTimerEdit();
  loadInitialSettings();
  loadPlayers();
  updateMicButton();
  initNotificationButtons();
  setupQuickNotificationEvents();
  setupPlayerSearch(); // Dodaj to wywołanie
}); 

// Dodaj tę funkcję przed setupQuickNotificationEvents
function closeQuickNotificationModal() {
  if (quickModal) {
    quickModal.classList.add('hidden');
    quickSelectedPlayer = null;
    quickSelectedType = null;
    quickSelectedPlayerIn = null;
  }
}

function showQuickNotificationModal(player) {
  if (quickModal && quickPlayerInfo) {
    quickSelectedPlayer = player;
    quickSelectedType = null;
    quickSelectedPlayerIn = null;
    quickPlayerInfo.innerHTML = `
      <div class="text-lg font-bold mb-2">${player.lastname} ${player.firstname}</div>
      <div class="text-sm text-gray-400 mb-2">${player.team === 'home' ? 'GOSPODARZE' : 'GOŚCIE'}</div>
    `;
    quickModal.classList.remove('hidden');
  }
}

// --- FUNKCJE MECZ, POWIADOMIENIA, TIMER, MIKROFON, SCOREBUG ---
// ...pozostałe funkcje (updateScore, toggleTimer, resetTimer, setTimerTo45, setTimerToZero, startStream, stopStream, switchScene, toggleMic, sendNotification, closeRepeatActivityModal, closeQuickNotificationModal, adjustPreviewTeamWidths, updateNotificationPreview, loadInitialSettings, loadPlayers, itp.) pozostają bez zmian i są już poprawnie zadeklarowane powyżej lub poniżej...

// --- GLOBAL EXPORTS DLA ONCLICK W HTML ---
// Przypisz funkcje do window po ich definicji!
window.closeQuickNotificationModal = closeQuickNotificationModal;
window.setupQuickNotificationEvents = setupQuickNotificationEvents;
window.updateScore = updateScore;
window.toggleTimer = toggleTimer;
window.resetTimer = resetTimer;
window.setTimerTo45 = setTimerTo45;
window.setTimerToZero = setTimerToZero;
window.startStream = startStream;
window.stopStream = stopStream;
window.switchScene = switchScene;
window.toggleMic = toggleMic;
window.sendNotification = sendNotification;
window.closeRepeatActivityModal = closeRepeatActivityModal;
window.showQuickNotificationModal = showQuickNotificationModal;
window.closeQuickNotificationModal = closeQuickNotificationModal;

// Dodaj przed window.addEventListener('load', ...)
function setupPlayerSearch() {
  if (!playerSearch || !playerSuggestions) return;
  
  playerSearch.addEventListener('input', function() {
    const searchText = normalizeString(this.value.toLowerCase());
    
    if (!searchText) {
      playerSuggestions.innerHTML = '';
      playerSuggestions.classList.add('hidden');
      return;
    }

    const matchingPlayers = allPlayers.filter(player => {
      const fullName = normalizeString(`${player.lastname} ${player.firstname}`.toLowerCase());
      return fullName.includes(searchText);
    });

    if (matchingPlayers.length > 0) {
      playerSuggestions.innerHTML = matchingPlayers
        .map(player => `
          <div class="px-4 py-2 hover:bg-purple-700 cursor-pointer">
            ${player.lastname} ${player.firstname} 
            <span class="text-gray-400 text-sm">(${player.team === 'home' ? 'GOSP' : 'GOŚCIE'})</span>
          </div>
        `)
        .join('');

      playerSuggestions.classList.remove('hidden');

      // Dodaj obsługę kliknięcia na sugestię
      playerSuggestions.querySelectorAll('div').forEach((div, index) => {
        div.onclick = () => {
          const player = matchingPlayers[index];
          showQuickNotificationModal(player);
          playerSearch.value = '';
          playerSuggestions.innerHTML = '';
          playerSuggestions.classList.add('hidden');
        };
      });
    } else {
      playerSuggestions.innerHTML = '<div class="px-4 py-2 text-gray-400">Nie znaleziono zawodnika</div>';
      playerSuggestions.classList.remove('hidden');
    }
  });

  // Ukryj sugestie przy kliknięciu poza wyszukiwarką
  document.addEventListener('click', function(e) {
    if (!playerSearch.contains(e.target) && !playerSuggestions.contains(e.target)) {
      playerSuggestions.classList.add('hidden');
    }
  });
}
