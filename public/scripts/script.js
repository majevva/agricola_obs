// --- ZMIENNE GLOBALNE ---
const obs = new window.OBSWebSocket(); // Poprawka: Użycie window.OBSWebSocket
let homeScore = 0;
let awayScore = 0;
let selectedPlayers = []; // Dla powiadomień z zakładki "Powiadomienia"
let notificationType = 'change'; // Domyślny typ powiadomienia z zakładki "Powiadomienia"
let notificationTeam = 'home'; // Domyślna drużyna dla powiadomienia
let allPlayers = []; // Cache wszystkich zawodników
let recentActivities = []; // Historia ostatnich akcji (np. z szybkich powiadomień)
const MAX_RECENT_ACTIVITIES = 8;

// Zmienne dla stanu timera i mikrofonu
let isTimerRunning = false;
let obsConnectionState = { connected: false, reconnecting: false, micMuted: true, streamActive: false };

// Zmienne dla plików logotypów (Intro Settings)
let homeLogoFile = null;
let awayLogoFile = null;

// Elementy DOM (będą inicjalizowane w DOMContentLoaded)
// Sidebar i Taby
let sidebarButtons, tabContents;

// Top Bar
let currentTimeEl, streamStatusIndicatorEl, streamStatusTextEl, streamControlBtn, streamControlIcon, streamControlText;

// Match Tab
let timerDisplayEl, timerEditBtn, timerToggleBtn, timerToggleIcon, timerToggleText, timerResetBtn, timerSetZeroBtn, timerSet45Btn;
let playerSearchInput, playerSearchSuggestionsEl, recentActivitiesListEl;

// Notifications Tab
let notificationTypesContainer, notificationInstructionsEl, homePlayersListEl, awayPlayersListEl;
let notificationPreviewEl, notificationPreviewMessageEl, sendNotificationBtn;
let previewTeamNameEl, previewChangeLabelEl, previewPlayerOutEl, previewPlayerInEl; // Elementy wewnątrz podglądu powiadomienia

// Score Tab
let scoreHomeDisplay, scoreAwayDisplay, scoreHomeNameDisplay, scoreAwayNameDisplay;
// Przyciski .update-score-btn będą obsługiwane przez querySelectorAll

// Scenes Tab
// Przyciski .switch-scene-btn będą obsługiwane przez querySelectorAll

// Settings Tab - Scorebug
let homeTeamNameScorebugInput, awayTeamNameScorebugInput, homeScoreBugInput, awayScoreBugInput;
let homeTeamColorInput, awayTeamColorInput, teamBackgroundColorInput, goalsBackgroundColorInput, timeBackgroundColorInput;
let teamTextColorInput, goalsTextColorInput, timeTextColorInput;
let homeHexEl, awayHexEl, teamBackgroundHexEl, goalsBackgroundHexEl, timeBackgroundHexEl;
let teamTextColorHexEl, goalsTextColorHexEl, timeTextColorHexEl;
let updateScorebugBtn;

// Settings Tab - Intro
let introHomeTeamFullNameInput, introAwayTeamFullNameInput, introMatchDateInput, introMatchTimeInput, introMatchLocationInput;
let introHomeLogoUploadInput, previewHomeLogoImg, introAwayLogoUploadInput, previewAwayLogoImg;
let updateIntroSettingsBtn;

// Settings Tab - OBS Stream & Player Management
let micSelectEl, micToggleBtn, micIconEl, cameraSelectEl, bitrateSliderEl, bitrateValueEl;
let clearPlayersCacheBtn;

// Modals
let quickNotificationModal, closeQuickNotificationModalBtn, quickPlayerInfoEl, quickNotifBtns, quickChangeSelectContainer, quickChangePlayerInSelect, quickSendBtn;
let repeatActivityModal, closeRepeatActivityModalBtn, repeatActivityInfoEl, repeatActivityBtn, repeatActivityNewBtn;

// Zmienne pomocnicze dla logiki modalów
let currentQuickPlayer = null;
let currentQuickNotificationType = null;
let currentQuickPlayerIn = null;
let currentRepeatActivity = null;


// --- FUNKCJE POMOCNICZE ---
const el = id => document.getElementById(id);
const q = selector => document.querySelector(selector);
const qa = selector => document.querySelectorAll(selector);

function normalizeString(str) {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L') : '';
}

function pad(num, size = 2) {
  return num.toString().padStart(size, '0');
}

function formatTimestampToTime(timestamp) {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// --- OBS WebSocket Connection ---
async function connectToOBS() {
    if (obsConnectionState.reconnecting || obs.socket) return; // obs.socket to sprawdzanie czy już jest połączenie

    obsConnectionState.reconnecting = true;
    const obsAddress = localStorage.getItem('obsAddress') || 'localhost'; // Domyślne wartości lub z localStorage
    const obsPort = localStorage.getItem('obsPort') || '4455';
    const obsPassword = localStorage.getItem('obsPassword') || ''; // Puste hasło jeśli nie ma

    console.log(`Attempting to connect to OBS: ws://${obsAddress}:${obsPort}`);

    try {
        await obs.connect(`ws://${obsAddress}:${obsPort}`, obsPassword);
        console.log('Successfully connected to OBS WebSocket.');
        obsConnectionState.connected = true;
        obsConnectionState.reconnecting = false;
        updateStreamStatusIndicator(true); // Zakładamy, że połączenie oznacza gotowość
        fetchOBSState(); // Pobierz początkowy stan OBS

        obs.on('ConnectionClosed', () => {
            console.warn('OBS WebSocket connection closed.');
            obsConnectionState.connected = false;
            obsConnectionState.reconnecting = false; // Pozwól na ponowną próbę
            updateStreamStatusIndicator(false);
            setTimeout(connectToOBS, 5000); // Próba ponownego połączenia po 5s
        });

        obs.on('StreamStateChanged', (data) => {
            obsConnectionState.streamActive = data.outputActive;
            updateStreamControlButton();
            console.log('Stream state changed:', data);
        });
        
        obs.on('InputMuteStateChanged', (data) => {
            if (data.inputName === (localStorage.getItem('selectedMicName') || 'Mikrofon')) { // Użyj wybranego mikrofonu
                obsConnectionState.micMuted = data.inputMuted;
                updateMicVisuals();
            }
        });


    } catch (error) {
        console.error('OBS WebSocket connection error:', error.message);
        obsConnectionState.connected = false;
        obsConnectionState.reconnecting = false;
        updateStreamStatusIndicator(false, 'Błąd połączenia');
        // Można dodać logikę ponawiania z backoffem
        setTimeout(connectToOBS, 10000); // Spróbuj ponownie po 10s
    }
}

async function fetchOBSState() {
    if (!obsConnectionState.connected) return;
    try {
        // Stream Status
        const streamStatus = await obs.call('GetStreamStatus');
        obsConnectionState.streamActive = streamStatus.outputActive;
        updateStreamControlButton();

        // Mic Status (użyj zapisanego mikrofonu lub domyślnego)
        const selectedMic = localStorage.getItem('selectedMicName') || (micSelectEl.options.length > 0 ? micSelectEl.value : 'Mikrofon');
        if (selectedMic) {
            const muteStatus = await obs.call('GetInputMute', { inputName: selectedMic });
            obsConnectionState.micMuted = muteStatus.inputMuted;
            updateMicVisuals();
        }
        populateAudioInputSources(); // Wypełnij listę mikrofonów
    } catch (error) {
        console.error("Error fetching initial OBS state:", error);
    }
}


// --- UI UPDATES ---
function updateStreamStatusIndicator(connected, statusText = null) {
    if (!streamStatusIndicatorEl || !streamStatusTextEl) return;
    if (connected) {
        streamStatusIndicatorEl.classList.remove('bg-red-500', 'bg-yellow-500');
        streamStatusIndicatorEl.classList.add('bg-green-500', 'pulse');
        streamStatusTextEl.textContent = statusText || 'POŁĄCZONO Z OBS';
        streamStatusTextEl.classList.remove('text-red-400', 'text-yellow-400');
        streamStatusTextEl.classList.add('text-green-400');
    } else {
        streamStatusIndicatorEl.classList.remove('bg-green-500', 'pulse');
        streamStatusIndicatorEl.classList.add('bg-red-500');
        streamStatusTextEl.textContent = statusText || 'BRAK POŁĄCZENIA Z OBS';
        streamStatusTextEl.classList.remove('text-green-400', 'text-yellow-400');
        streamStatusTextEl.classList.add('text-red-400');
    }
}

function updateStreamControlButton() {
    if (!streamControlBtn || !streamControlIcon || !streamControlText) return;
    if (obsConnectionState.streamActive) {
        streamControlBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        streamControlBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        streamControlIcon.classList.remove('fa-play');
        streamControlIcon.classList.add('fa-stop');
        streamControlText.textContent = 'Stop Stream';
    } else {
        streamControlBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        streamControlBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        streamControlIcon.classList.remove('fa-stop');
        streamControlIcon.classList.add('fa-play');
        streamControlText.textContent = 'Start Stream';
    }
}

function updateCurrentTime() {
    if (!currentTimeEl) return;
    const now = new Date();
    currentTimeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function updateTimerDisplayUI(minutes, seconds) {
    if (timerDisplayEl && !timerDisplayEl.querySelector('input')) { // Nie aktualizuj, jeśli input jest aktywny
        timerDisplayEl.textContent = `${pad(minutes)}:${pad(seconds)}`;
    }
}

function updateTimerToggleButtonUI(running) {
    if (!timerToggleBtn || !timerToggleIcon || !timerToggleText) return;
    if (running) {
        timerToggleBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        timerToggleBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
        timerToggleIcon.classList.remove('fa-play');
        timerToggleIcon.classList.add('fa-pause');
        timerToggleText.textContent = 'Pauza';
    } else {
        timerToggleBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
        timerToggleBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        timerToggleIcon.classList.remove('fa-pause');
        timerToggleIcon.classList.add('fa-play');
        timerToggleText.textContent = 'Start';
    }
}

function updateMicVisuals() {
    if (!micToggleBtn || !micIconEl) return;
    const selectedMicName = localStorage.getItem('selectedMicName') || (micSelectEl.options.length > 0 ? micSelectEl.value : 'Mikrofon');
    
    if (obsConnectionState.micMuted) {
        micToggleBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        micToggleBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        micIconEl.classList.remove('fa-microphone');
        micIconEl.classList.add('fa-microphone-slash');
        micToggleBtn.setAttribute('aria-label', `Włącz mikrofon ${selectedMicName}`);
    } else {
        micToggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        micToggleBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        micIconEl.classList.remove('fa-microphone-slash');
        micIconEl.classList.add('fa-microphone');
        micToggleBtn.setAttribute('aria-label', `Wycisz mikrofon ${selectedMicName}`);
    }
}


// --- TAB SWITCHING ---
function setupTabs() {
    sidebarButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.dataset.tab;
            tabContents.forEach(tab => {
                tab.classList.remove('active');
                if (tab.id === targetTabId) {
                    tab.classList.add('active');
                }
            });
            sidebarButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

// --- TIMER LOGIC ---
async function handleTimerAction(action, minutes = null, seconds = null) {
    if (!obsConnectionState.connected && !['set', 'set45', 'setZero', 'reset'].includes(action)) { // Allow local set/reset if not connected
        alert('Brak połączenia z OBS. Nie można sterować timerem.');
        return;
    }
    try {
        const payload = { action };
        if (minutes !== null) payload.minute = pad(minutes);
        if (seconds !== null) payload.second = pad(seconds);

        const response = await fetch('/update-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Błąd serwera: ${response.statusText}`);
        
        const data = await response.json();
        isTimerRunning = data.running; // Serwer powinien zwrócić aktualny stan
        updateTimerToggleButtonUI(isTimerRunning);
        if (data.minute !== undefined && data.second !== undefined) {
             updateTimerDisplayUI(data.minute, data.second);
        } else if (action === 'reset' || action === 'setZero') {
            updateTimerDisplayUI('00', '00');
        } else if (action === 'set45') {
            updateTimerDisplayUI('45', '00');
        }

    } catch (error) {
        console.error(`Error ${action} timer:`, error);
        alert(`Nie udało się wykonać akcji timera: ${action}.`);
    }
}

function setupTimerControls() {
    if (timerToggleBtn) timerToggleBtn.addEventListener('click', () => handleTimerAction(isTimerRunning ? 'pause' : 'start'));
    if (timerResetBtn) timerResetBtn.addEventListener('click', () => handleTimerAction('reset'));
    if (timerSetZeroBtn) timerSetZeroBtn.addEventListener('click', () => handleTimerAction('setZero'));
    if (timerSet45Btn) timerSet45Btn.addEventListener('click', () => handleTimerAction('set45'));
    if (timerEditBtn) setupTimerEditMode();
}

function setupTimerEditMode() {
    if (!timerDisplayEl || !timerEditBtn) return;
    timerEditBtn.addEventListener('click', () => {
        if (timerDisplayEl.querySelector('input')) return; // Already in edit mode

        const currentText = timerDisplayEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'text-5xl font-mono font-bold text-center text-white bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded';
        
        timerDisplayEl.innerHTML = ''; // Clear current text
        timerDisplayEl.appendChild(input);
        input.focus();
        input.select();

        const बाहरJa = async (save) => {
            const newTime = input.value.trim();
            timerDisplayEl.innerHTML = currentText; // Restore original or new time
            if (save && /^\d{1,2}:\d{2}$/.test(newTime)) {
                const [min, sec] = newTime.split(':').map(Number);
                await handleTimerAction('set', min, sec);
                timerDisplayEl.textContent = `${pad(min)}:${pad(sec)}`;
            } else if (save) {
                alert('Nieprawidłowy format czasu. Użyj MM:SS.');
                timerDisplayEl.textContent = currentText; // Restore original if invalid
            }
        };

        input.addEventListener('blur', () => बाहरJa(false)); // Save on blur could be added by passing true
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') बाहरJa(true);
            if (e.key === 'Escape') बाहरJa(false);
        });
    });
}


// --- SCORE LOGIC ---
async function updateScore(team, delta) {
    const currentScore = team === 'home' ? homeScore : awayScore;
    const newScore = Math.max(0, currentScore + delta);

    if (team === 'home') homeScore = newScore;
    else awayScore = newScore;

    if (scoreHomeDisplay) scoreHomeDisplay.textContent = homeScore;
    if (scoreAwayDisplay) scoreAwayDisplay.textContent = awayScore;
    
    // Update scorebug inputs as well, if they exist
    if (homeScoreBugInput) homeScoreBugInput.value = homeScore;
    if (awayScoreBugInput) awayScoreBugInput.value = awayScore;

    try {
        await fetch('/update-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team, score: newScore })
        });
    } catch (error) {
        console.error('Błąd aktualizacji wyniku na serwerze:', error);
        // Revert UI on error? Or show error message.
    }
}

function setupScoreControls() {
    qa('.update-score-btn').forEach(button => {
        button.addEventListener('click', () => {
            const team = button.dataset.team;
            const action = button.dataset.action === 'increment' ? 1 : -1;
            updateScore(team, action);
        });
    });
}


// --- PLAYER & NOTIFICATION LOGIC ---
async function loadPlayers() {
    try {
        const response = await fetch('/players-data');
        if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);
        const data = await response.json();
        allPlayers = [
            ...(data.home || []).map(p => ({ ...p, team: 'home', displayName: `${p.lastname} ${p.firstname} (${p.number})` })),
            ...(data.away || []).map(p => ({ ...p, team: 'away', displayName: `${p.lastname} ${p.firstname} (${p.number})` }))
        ];
        allPlayers.sort((a,b) => a.displayName.localeCompare(b.displayName)); // Sort all players for combined lists if needed

        populatePlayerList(homePlayersListEl, data.home || [], 'home');
        populatePlayerList(awayPlayersListEl, data.away || [], 'away');
    } catch (error) {
        console.error('Błąd ładowania zawodników:', error);
        if (homePlayersListEl) homePlayersListEl.innerHTML = '<p class="text-red-500 text-xs p-2">Błąd ładowania gospodarzy.</p>';
        if (awayPlayersListEl) awayPlayersListEl.innerHTML = '<p class="text-red-500 text-xs p-2">Błąd ładowania gości.</p>';
    }
}

function populatePlayerList(listElement, players, teamName) {
    if (!listElement) return;
    listElement.innerHTML = ''; // Clear existing
    if (!players || players.length === 0) {
        listElement.innerHTML = `<p class="text-slate-500 text-xs text-center py-4">Brak zawodników dla ${teamName === 'home' ? 'gospodarzy' : 'gości'}.</p>`;
        return;
    }
    players.sort((a,b) => (a.lastname + a.firstname).localeCompare(b.lastname + b.firstname));
    players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item p-2 rounded hover:bg-slate-700 cursor-pointer flex items-center text-sm';
        item.dataset.team = teamName;
        item.dataset.number = player.number;
        // item.innerHTML = `<div class="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs mr-2 player-number-badge">${player.number}</div><span>${player.lastname} ${player.firstname}</span>`;
        item.innerHTML = `<span class="font-mono text-xs w-6 text-center mr-2 opacity-70">${pad(player.number)}</span><span>${player.lastname} ${player.firstname}</span>`;
        item.addEventListener('click', () => handlePlayerSelection(item, player, teamName));
        listElement.appendChild(item);
    });
}

function handlePlayerSelection(element, player, team) {
    const isSelected = element.classList.contains('selected');

    if (isSelected) {
        element.classList.remove('selected');
        selectedPlayers = selectedPlayers.filter(p => !(p.number === player.number && p.team === team));
    } else {
        if (notificationType === 'change') {
            if (selectedPlayers.length > 0 && selectedPlayers[0].team !== team) {
                alert('Przy zmianie obaj zawodnicy muszą być z tej samej drużyny.');
                return;
            }
            if (selectedPlayers.length >= 2) {
                // Deselect the first selected player if trying to select a third for a change
                const firstSelected = selectedPlayers.shift();
                const firstSelectedEl = qa(`.player-item.selected[data-team='${firstSelected.team}'][data-number='${firstSelected.number}']`);
                if (firstSelectedEl.length > 0) firstSelectedEl[0].classList.remove('selected');
            }
        } else { // For goal, card, injury - only one player
            if (selectedPlayers.length > 0) {
                const prevSelected = selectedPlayers.pop();
                const prevSelectedEl = qa(`.player-item.selected[data-team='${prevSelected.team}'][data-number='${prevSelected.number}']`);
                if (prevSelectedEl.length > 0) prevSelectedEl[0].classList.remove('selected');
            }
        }
        element.classList.add('selected');
        selectedPlayers.push({ ...player, team });
    }
    updateUINotificationPreview();
}

function updateNotificationInstructionsUI() {
    if (!notificationInstructionsEl) return;
    const type = notificationType; // Use the global notificationType
    if (type === 'change') notificationInstructionsEl.textContent = 'Wybierz dwóch zawodników z tej samej drużyny (pierwszy schodzi, drugi wchodzi).';
    else if (type === 'yellow-card') notificationInstructionsEl.textContent = 'Wybierz zawodnika, który otrzymał żółtą kartkę.';
    else if (type === 'red-card') notificationInstructionsEl.textContent = 'Wybierz zawodnika, który otrzymał czerwoną kartkę.';
    else if (type === 'injury') notificationInstructionsEl.textContent = 'Wybierz kontuzjowanego zawodnika.';
    else if (type === 'goal') notificationInstructionsEl.textContent = 'Wybierz strzelca bramki.';
    else notificationInstructionsEl.textContent = 'Wybierz typ powiadomienia i zawodników.';
}

function clearAllPlayerSelections() {
    qa('.player-item.selected').forEach(el => el.classList.remove('selected'));
    selectedPlayers = [];
    updateUINotificationPreview(); // Update preview to reflect cleared selection
}

function setupNotificationControls() {
    if (notificationTypesContainer) {
        notificationTypesContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.notification-type-btn');
            if (button) {
                qa('.notification-type-btn').forEach(btn => btn.classList.remove('active', 'border-indigo-500', 'shadow-lg'));
                button.classList.add('active', 'border-indigo-500', 'shadow-lg');
                notificationType = button.dataset.type;
                updateNotificationInstructionsUI();
                clearAllPlayerSelections(); // Clear selections when type changes
            }
        });
    }
    if (sendNotificationBtn) {
        sendNotificationBtn.addEventListener('click', sendUINotification);
    }
    // Set default active notification type
    const defaultNotifBtn = q('.notification-type-btn[data-type="change"]');
    if (defaultNotifBtn) {
        defaultNotifBtn.click(); // Simulate click to set initial state
    }
}

async function updateUINotificationPreview() {
    if (!notificationPreviewEl || !notificationPreviewMessageEl || !previewTeamNameEl || !previewChangeLabelEl || !previewPlayerOutEl || !previewPlayerInEl || !sendNotificationBtn) {
        console.warn("Missing elements for notification preview.");
        return;
    }

    const requiredPlayers = notificationType === 'change' ? 2 : 1;
    const isValidSelection = selectedPlayers.length === requiredPlayers || (notificationType !== 'change' && selectedPlayers.length === 1);

    if (!isValidSelection || selectedPlayers.length === 0) {
        notificationPreviewEl.classList.add('hidden');
        notificationPreviewMessageEl.classList.remove('hidden');
        notificationPreviewMessageEl.textContent = 'Wybierz typ i zawodnika/ów.';
        sendNotificationBtn.disabled = true;
        return;
    }

    notificationPreviewEl.classList.remove('hidden');
    notificationPreviewMessageEl.classList.add('hidden');
    sendNotificationBtn.disabled = false;

    const playerOut = selectedPlayers[0];
    const playerIn = (notificationType === 'change' && selectedPlayers.length > 1) ? selectedPlayers[1] : null;
    
    notificationTeam = playerOut.team; // Set based on the first selected player

    // Update labels and content
    let labelText = '';
    switch (notificationType) {
        case 'change': labelText = 'Zmiana'; break;
        case 'yellow-card': labelText = 'Żółta Kartka'; break;
        case 'red-card': labelText = 'Czerwona Kartka'; break;
        case 'injury': labelText = 'Kontuzja'; break;
        case 'goal': labelText = 'GOL!'; break;
        default: labelText = 'Powiadomienie';
    }
    previewChangeLabelEl.textContent = labelText;

    previewPlayerOutEl.querySelector('.name').textContent = `${playerOut.lastname} ${playerOut.firstname}`;
    // Icons for player out based on type
    let outIconHtml = '➡️'; // Default for change
    if (notificationType === 'yellow-card') outIconHtml = '<i class="fas fa-square text-yellow-400"></i>';
    else if (notificationType === 'red-card') outIconHtml = '<i class="fas fa-square text-red-500"></i>';
    else if (notificationType === 'injury') outIconHtml = '<i class="fas fa-medkit text-gray-400"></i>';
    else if (notificationType === 'goal') outIconHtml = '<i class="fas fa-futbol text-green-400"></i>';
    previewPlayerOutEl.querySelector('.arrow').innerHTML = outIconHtml;


    if (playerIn) {
        previewPlayerInEl.style.display = 'flex';
        previewPlayerInEl.querySelector('.name').textContent = `${playerIn.lastname} ${playerIn.firstname}`;
        previewPlayerInEl.querySelector('.arrow').innerHTML = '⬅️';
        q('#notification-preview .player-list').classList.remove('one-player');
        q('#notification-preview .player-list').classList.add('two-players');
    } else {
        previewPlayerInEl.style.display = 'none';
        q('#notification-preview .player-list').classList.remove('two-players');
        q('#notification-preview .player-list').classList.add('one-player');
    }

    // Fetch current team names and colors for preview styling
    try {
        const settingsRes = await fetch('/initial-settings'); // Scorebug settings for colors/names
        const settings = await settingsRes.json();
        
        previewTeamNameEl.textContent = notificationTeam === 'home' ? (settings.homeName || 'GOSPODARZE') : (settings.awayName || 'GOŚCIE');
        const teamHeaderColorDiv = q('#notification-preview .team-header .color');
        if (teamHeaderColorDiv) teamHeaderColorDiv.style.backgroundColor = notificationTeam === 'home' ? settings.homeColor : settings.awayColor;
        
        const teamHeaderDiv = q('#notification-preview .team-header');
        if(teamHeaderDiv) teamHeaderDiv.style.backgroundColor = settings.teamBackground;
        if(previewTeamNameEl) previewTeamNameEl.style.color = settings.teamTextColor;

        if(previewChangeLabelEl.parentElement) previewChangeLabelEl.parentElement.style.backgroundColor = settings.goalsBackground;
        if(previewChangeLabelEl) previewChangeLabelEl.style.color = settings.goalsTextColor;
        
        if(previewPlayerOutEl) {
            previewPlayerOutEl.style.backgroundColor = settings.teamBackground; // Same as team header
            previewPlayerOutEl.style.color = settings.teamTextColor;
        }
        if(playerIn && previewPlayerInEl){ // Style for incoming player
            previewPlayerInEl.style.backgroundColor = settings.teamTextColor; // Inverted colors
            previewPlayerInEl.style.color = settings.teamBackground;
        }

    } catch (error) {
        console.error("Error fetching settings for notification preview:", error);
    }
}

async function sendUINotification() {
    const requiredPlayers = notificationType === 'change' ? 2 : 1;
    if (selectedPlayers.length !== requiredPlayers) {
        alert(`Proszę wybrać ${requiredPlayers} zawodnika/ów dla tego typu powiadomienia.`);
        return;
    }

    const data = {
        type: notificationType,
        team: selectedPlayers[0].team, // Team of the first selected player
        playerOut: selectedPlayers[0],
        playerIn: (notificationType === 'change' && selectedPlayers.length > 1) ? selectedPlayers[1] : null,
        timestamp: Date.now()
    };

    try {
        const response = await fetch('/update-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`Błąd serwera: ${response.statusText}`);
        
        addRecentActivityUI(data); // Add to UI list
        clearAllPlayerSelections(); // Clear selection and update preview
        console.log('Powiadomienie wysłane:', data);
    } catch (error) {
        console.error('Błąd wysyłania powiadomienia:', error);
        alert('Nie udało się wysłać powiadomienia.');
    }
}

// --- QUICK ACTIONS & RECENT ACTIVITIES (Match Tab) ---
function setupQuickActions() {
    if (playerSearchInput) {
        playerSearchInput.addEventListener('input', () => {
            const query = normalizeString(playerSearchInput.value.toLowerCase());
            if (!query) {
                if(playerSearchSuggestionsEl) playerSearchSuggestionsEl.classList.add('hidden');
                return;
            }
            const matched = allPlayers.filter(p => 
                normalizeString(p.displayName.toLowerCase()).includes(query)
            ).slice(0, 5);
            
            if (playerSearchSuggestionsEl) {
                playerSearchSuggestionsEl.innerHTML = '';
                if (matched.length > 0) {
                    matched.forEach(player => {
                        const div = document.createElement('div');
                        div.className = 'p-2 hover:bg-slate-600 cursor-pointer text-sm';
                        div.textContent = player.displayName;
                        div.onclick = () => {
                            currentQuickPlayer = player;
                            showQuickNotificationModalUI();
                            playerSearchInput.value = '';
                            playerSearchSuggestionsEl.classList.add('hidden');
                        };
                        playerSearchSuggestionsEl.appendChild(div);
                    });
                    playerSearchSuggestionsEl.classList.remove('hidden');
                } else {
                    playerSearchSuggestionsEl.classList.add('hidden');
                }
            }
        });
         // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (playerSearchSuggestionsEl && !playerSearchInput.contains(e.target) && !playerSearchSuggestionsEl.contains(e.target)) {
                playerSearchSuggestionsEl.classList.add('hidden');
            }
        });
    }
}

function showQuickNotificationModalUI() {
    if (!quickNotificationModal || !quickPlayerInfoEl || !currentQuickPlayer) return;
    quickPlayerInfoEl.innerHTML = `
        <div class="font-semibold text-indigo-400">${currentQuickPlayer.displayName}</div>
        <div class="text-xs text-slate-400">${currentQuickPlayer.team === 'home' ? 'Gospodarze' : 'Goście'}</div>`;
    
    // Reset state
    currentQuickNotificationType = null;
    currentQuickPlayerIn = null;
    if(quickChangeSelectContainer) quickChangeSelectContainer.classList.add('hidden');
    if(quickSendBtn) quickSendBtn.disabled = true;
    qa('.quick-notif-btn').forEach(btn => btn.classList.remove('bg-indigo-500', 'ring-2', 'ring-indigo-400'));


    quickNotificationModal.classList.remove('hidden');
}

function setupQuickNotificationModalActions() {
    if (closeQuickNotificationModalBtn) closeQuickNotificationModalBtn.onclick = () => quickNotificationModal.classList.add('hidden');
    
    if (quickNotifBtns) {
        quickNotifBtns.forEach(btn => {
            btn.onclick = () => {
                currentQuickNotificationType = btn.dataset.type;
                quickNotifBtns.forEach(b => b.classList.remove('bg-indigo-500', 'ring-2', 'ring-indigo-400'));
                btn.classList.add('bg-indigo-500', 'ring-2', 'ring-indigo-400');

                if (currentQuickNotificationType === 'change') {
                    populateQuickChangePlayerInSelect();
                    if(quickChangeSelectContainer) quickChangeSelectContainer.classList.remove('hidden');
                    if(quickSendBtn) quickSendBtn.disabled = !quickChangePlayerInSelect.value; // Enable if a player is selected
                } else {
                    if(quickChangeSelectContainer) quickChangeSelectContainer.classList.add('hidden');
                    if(quickSendBtn) quickSendBtn.disabled = false;
                }
            };
        });
    }

    if (quickChangePlayerInSelect) {
        quickChangePlayerInSelect.onchange = () => {
            currentQuickPlayerIn = allPlayers.find(p => p.team === currentQuickPlayer.team && p.number.toString() === quickChangePlayerInSelect.value);
            if(quickSendBtn) quickSendBtn.disabled = !currentQuickPlayerIn;
        };
    }

    if (quickSendBtn) {
        quickSendBtn.onclick = async () => {
            if (!currentQuickPlayer || !currentQuickNotificationType) return;
            if (currentQuickNotificationType === 'change' && !currentQuickPlayerIn) {
                alert('Wybierz zawodnika wchodzącego.');
                return;
            }
            const notificationData = {
                type: currentQuickNotificationType,
                team: currentQuickPlayer.team,
                playerOut: currentQuickPlayer, // For goal/card/injury, this is the main player
                playerIn: currentQuickNotificationType === 'change' ? currentQuickPlayerIn : null,
                timestamp: Date.now()
            };
            try {
                const response = await fetch('/update-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(notificationData)
                });
                if (!response.ok) throw new Error('Błąd wysyłania powiadomienia');
                addRecentActivityUI(notificationData);
                quickNotificationModal.classList.add('hidden');
            } catch (error) {
                console.error("Błąd wysyłania szybkiego powiadomienia:", error);
                alert('Nie udało się wysłać powiadomienia.');
            }
        };
    }
}

function populateQuickChangePlayerInSelect() {
    if (!quickChangePlayerInSelect || !currentQuickPlayer) return;
    const teamPlayers = allPlayers.filter(p => p.team === currentQuickPlayer.team && p.number !== currentQuickPlayer.number);
    quickChangePlayerInSelect.innerHTML = '<option value="">Wybierz...</option>'; // Default empty option
    teamPlayers.forEach(p => {
        const option = document.createElement('option');
        option.value = p.number;
        option.textContent = p.displayName;
        quickChangePlayerInSelect.appendChild(option);
    });
    currentQuickPlayerIn = null; // Reset selected incoming player
}


function addRecentActivityUI(activity) {
    recentActivities.unshift(activity);
    if (recentActivities.length > MAX_RECENT_ACTIVITIES) {
        recentActivities.pop();
    }
    renderRecentActivitiesUI();
    localStorage.setItem('streamPanelRecentActivities', JSON.stringify(recentActivities));
}

function renderRecentActivitiesUI() {
    if (!recentActivitiesListEl) return;
    recentActivitiesListEl.innerHTML = ''; // Clear current list

    if (recentActivities.length === 0) {
        recentActivitiesListEl.innerHTML = `
            <div class="bg-slate-900 rounded-lg p-3 flex items-center justify-between opacity-50">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <i class="fas fa-stream text-slate-400 text-xs"></i>
                </div>
                <div>
                  <div class="font-medium text-slate-400">Brak ostatnich akcji</div>
                  <div class="text-xs text-slate-500">--:--</div>
                </div>
              </div>
            </div>`;
        return;
    }

    recentActivities.forEach(act => {
        const item = document.createElement('div');
        item.className = 'bg-slate-900 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-slate-700 transition-all';
        
        let iconClass = 'fas fa-info-circle';
        let iconBgColor = 'bg-slate-600';
        let mainText = `${act.playerOut.lastname} ${act.playerOut.firstname}`;

        switch(act.type) {
            case 'goal': 
                iconClass = 'fas fa-futbol'; iconBgColor = 'bg-green-600'; mainText += ' - Gol!'; break;
            case 'yellow-card': 
                iconClass = 'fas fa-square'; iconBgColor = 'bg-yellow-500'; mainText += ' - Żółta kartka'; break;
            case 'red-card': 
                iconClass = 'fas fa-square'; iconBgColor = 'bg-red-600'; mainText += ' - Czerwona kartka'; break;
            case 'injury': 
                iconClass = 'fas fa-medkit'; iconBgColor = 'bg-orange-500'; mainText += ' - Kontuzja'; break;
            case 'change': 
                iconClass = 'fas fa-exchange-alt'; iconBgColor = 'bg-blue-500'; 
                mainText += ` ⇔ ${act.playerIn ? act.playerIn.lastname + ' ' + act.playerIn.firstname : '?'}`;
                break;
        }

        item.innerHTML = `
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 rounded-full ${iconBgColor} flex items-center justify-center">
                <i class="${iconClass} text-white text-xs"></i>
              </div>
              <div>
                <div class="font-medium text-sm">${mainText}</div>
                <div class="text-xs text-slate-400">${formatTimestampToTime(act.timestamp)} (${act.team === 'home' ? 'Gosp.' : 'Gość.'})</div>
              </div>
            </div>
            <button class="text-slate-400 hover:text-white text-xs" aria-label="Opcje akcji">
              <i class="fas fa-ellipsis-v"></i> </button>
        `;
        item.onclick = () => showRepeatActivityModalUI(act);
        recentActivitiesListEl.appendChild(item);
    });
}

function showRepeatActivityModalUI(activity) {
    if (!repeatActivityModal || !repeatActivityInfoEl) return;
    currentRepeatActivity = activity;
    let activityDesc = `${activity.playerOut.lastname} ${activity.playerOut.firstname}`;
    if (activity.type === 'change' && activity.playerIn) activityDesc += ` ⇔ ${activity.playerIn.lastname}`;
    
    repeatActivityInfoEl.innerHTML = `
        <div class="font-semibold text-indigo-400 mb-1">${activityDesc}</div>
        <div class="text-sm text-slate-300">Typ: ${activity.type}, Czas: ${formatTimestampToTime(activity.timestamp)}</div>
    `;
    repeatActivityModal.classList.remove('hidden');
}

function setupRepeatActivityModalActions() {
    if(closeRepeatActivityModalBtn) closeRepeatActivityModalBtn.onclick = () => repeatActivityModal.classList.add('hidden');
    if(repeatActivityBtn) {
        repeatActivityBtn.onclick = async () => {
            if (!currentRepeatActivity) return;
            const repeatData = { ...currentRepeatActivity, timestamp: Date.now() }; // New timestamp
            try {
                const response = await fetch('/update-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(repeatData)
                });
                if (!response.ok) throw new Error('Błąd wysyłania powtórki');
                addRecentActivityUI(repeatData);
                repeatActivityModal.classList.add('hidden');
            } catch (error) {
                console.error("Błąd powtarzania aktywności:", error);
                alert('Nie udało się powtórzyć powiadomienia.');
            }
        };
    }
    if(repeatActivityNewBtn) {
        repeatActivityNewBtn.onclick = () => {
            if (!currentRepeatActivity || !currentRepeatActivity.playerOut) return;
            currentQuickPlayer = currentRepeatActivity.playerOut; // Set for quick modal
            repeatActivityModal.classList.add('hidden');
            showQuickNotificationModalUI(); // Open quick modal with this player
        };
    }
}


// --- SCENES ---
function setupSceneControls() {
    qa('.switch-scene-btn').forEach(button => {
        button.addEventListener('click', async () => {
            if (!obsConnectionState.connected) {
                alert('Brak połączenia z OBS. Nie można przełączyć sceny.');
                return;
            }
            const sceneName = button.dataset.sceneName;
            try {
                await obs.call('SetCurrentProgramScene', { sceneName });
                console.log(`Przełączono na scenę: ${sceneName}`);
                // Można dodać wizualne potwierdzenie
            } catch (error) {
                console.error(`Błąd przełączania na scenę ${sceneName}:`, error);
                alert(`Nie udało się przełączyć na scenę: ${sceneName}. Sprawdź konsolę OBS.`);
            }
        });
    });
}

// --- SETTINGS ---
// Scorebug Settings
function loadScorebugSettings() {
    // Nazwy i wyniki są ładowane przez loadInitialDataForScoreDisplay
    // Kolory:
    const settings = { // Domyślne wartości, jeśli serwer nie odpowie lub nie ma zapisanych
        homeColor: '#C8102E', awayColor: '#1B449C', teamBackground: '#34003A',
        goalsBackground: '#00FC8A', timeBackground: '#FFFFFF', teamTextColor: '#FFFFFF',
        goalsTextColor: '#34003A', timeTextColor: '#34003A',
        homeName: 'GOSPODARZE', awayName: 'GOŚCIE', homeScore: 0, awayScore: 0
    };

    fetch('/initial-settings') // Endpoint dla ustawień scorebuga
        .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(data => {
            Object.assign(settings, data); // Nadpisz domyślne załadowanymi
            if (homeTeamNameScorebugInput) homeTeamNameScorebugInput.value = settings.homeName;
            if (awayTeamNameScorebugInput) awayTeamNameScorebugInput.value = settings.awayName;
            if (homeScoreBugInput) homeScoreBugInput.value = settings.homeScore;
            if (awayScoreBugInput) awayScoreBugInput.value = settings.awayScore;

            if (homeTeamColorInput) homeTeamColorInput.value = settings.homeColor;
            if (awayTeamColorInput) awayTeamColorInput.value = settings.awayColor;
            if (teamBackgroundColorInput) teamBackgroundColorInput.value = settings.teamBackground;
            if (goalsBackgroundColorInput) goalsBackgroundColorInput.value = settings.goalsBackground;
            if (timeBackgroundColorInput) timeBackgroundColorInput.value = settings.timeBackground;
            if (teamTextColorInput) teamTextColorInput.value = settings.teamTextColor;
            if (goalsTextColorInput) goalsTextColorInput.value = settings.goalsTextColor;
            if (timeTextColorInput) timeTextColorInput.value = settings.timeTextColor;
            updateHexDisplays();
        })
        .catch(error => {
            console.error("Błąd ładowania ustawień scorebuga:", error);
            // Użyj domyślnych, jeśli są zdefiniowane elementy
            if (homeTeamNameScorebugInput) homeTeamNameScorebugInput.value = settings.homeName;
            // ... reszta domyślnych ...
            updateHexDisplays(); // Aktualizuj HEX dla domyślnych kolorów
        });
}

function updateHexDisplays() {
    if(homeHexEl && homeTeamColorInput) homeHexEl.textContent = homeTeamColorInput.value.toUpperCase();
    if(awayHexEl && awayTeamColorInput) awayHexEl.textContent = awayTeamColorInput.value.toUpperCase();
    if(teamBackgroundHexEl && teamBackgroundColorInput) teamBackgroundHexEl.textContent = teamBackgroundColorInput.value.toUpperCase();
    if(goalsBackgroundHexEl && goalsBackgroundColorInput) goalsBackgroundHexEl.textContent = goalsBackgroundColorInput.value.toUpperCase();
    if(timeBackgroundHexEl && timeBackgroundColorInput) timeBackgroundHexEl.textContent = timeBackgroundColorInput.value.toUpperCase();
    if(teamTextColorHexEl && teamTextColorInput) teamTextColorHexEl.textContent = teamTextColorInput.value.toUpperCase();
    if(goalsTextColorHexEl && goalsTextColorInput) goalsTextColorHexEl.textContent = goalsTextColorInput.value.toUpperCase();
    if(timeTextColorHexEl && timeTextColorInput) timeTextColorHexEl.textContent = timeTextColorInput.value.toUpperCase();
}

function setupScorebugSettingsControls() {
    const colorInputs = [
        homeTeamColorInput, awayTeamColorInput, teamBackgroundColorInput, goalsBackgroundColorInput,
        timeBackgroundColorInput, teamTextColorInput, goalsTextColorInput, timeTextColorInput
    ];
    colorInputs.forEach(input => {
        if (input) input.addEventListener('input', updateHexDisplays);
    });

    if (updateScorebugBtn) {
        updateScorebugBtn.addEventListener('click', async () => {
            const scorebugData = {
                homeName: homeTeamNameScorebugInput.value,
                awayName: awayTeamNameScorebugInput.value,
                homeScore: parseInt(homeScoreBugInput.value) || 0,
                awayScore: parseInt(awayScoreBugInput.value) || 0,
                homeColor: homeTeamColorInput.value,
                awayColor: awayTeamColorInput.value,
                teamBackground: teamBackgroundColorInput.value,
                goalsBackground: goalsBackgroundColorInput.value,
                timeBackground: timeBackgroundColorInput.value,
                teamTextColor: teamTextColorInput.value,
                goalsTextColor: goalsTextColorInput.value,
                timeTextColor: timeTextColorInput.value,
            };
            try {
                const response = await fetch('/update-scorebug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(scorebugData)
                });
                if (!response.ok) throw new Error('Błąd aktualizacji scorebuga na serwerze.');
                alert('Ustawienia scorebuga zaktualizowane!');
                // Odśwież wyświetlanie wyników w zakładce "Wynik", jeśli są powiązane
                homeScore = scorebugData.homeScore;
                awayScore = scorebugData.awayScore;
                if(scoreHomeDisplay) scoreHomeDisplay.textContent = homeScore;
                if(scoreAwayDisplay) scoreAwayDisplay.textContent = awayScore;
                if(scoreHomeNameDisplay && homeTeamNameScorebugInput) scoreHomeNameDisplay.textContent = homeTeamNameScorebugInput.value;
                if(scoreAwayNameDisplay && awayTeamNameScorebugInput) scoreAwayNameDisplay.textContent = awayTeamNameScorebugInput.value;

            } catch (error) {
                console.error("Błąd zapisu ustawień scorebuga:", error);
                alert('Nie udało się zapisać ustawień scorebuga.');
            }
        });
    }
}

// Intro Settings
function loadIntroSettings() {
    fetch('/initial-intro-settings')
        .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(settings => {
            if (introHomeTeamFullNameInput) introHomeTeamFullNameInput.value = settings.introHomeTeamFullName || '';
            if (introAwayTeamFullNameInput) introAwayTeamFullNameInput.value = settings.introAwayTeamFullName || '';
            if (introMatchDateInput) introMatchDateInput.value = settings.introMatchDate || '';
            if (introMatchTimeInput) introMatchTimeInput.value = settings.introMatchTime || '';
            if (introMatchLocationInput) introMatchLocationInput.value = settings.introMatchLocation || '';

            if (settings.homeLogoPath && previewHomeLogoImg) {
                previewHomeLogoImg.src = settings.homeLogoPath + '?t=' + new Date().getTime();
                previewHomeLogoImg.classList.remove('hidden');
            } else if (previewHomeLogoImg) {
                previewHomeLogoImg.src = "#"; previewHomeLogoImg.classList.add('hidden');
            }
            if (settings.awayLogoPath && previewAwayLogoImg) {
                previewAwayLogoImg.src = settings.awayLogoPath + '?t=' + new Date().getTime();
                previewAwayLogoImg.classList.remove('hidden');
            } else if (previewAwayLogoImg) {
                previewAwayLogoImg.src = "#"; previewAwayLogoImg.classList.add('hidden');
            }
        })
        .catch(error => console.error('Błąd ładowania ustawień Intro:', error));
}

function setupIntroSettingsControls() {
    if (introHomeLogoUploadInput && previewHomeLogoImg) {
        introHomeLogoUploadInput.addEventListener('change', (e) => handleLogoUpload(e, previewHomeLogoImg, 'home'));
    }
    if (introAwayLogoUploadInput && previewAwayLogoImg) {
        introAwayLogoUploadInput.addEventListener('change', (e) => handleLogoUpload(e, previewAwayLogoImg, 'away'));
    }
    if (updateIntroSettingsBtn) {
        updateIntroSettingsBtn.addEventListener('click', saveIntroSettingsData);
    }
}

function handleLogoUpload(event, previewElement, teamType) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewElement.src = e.target.result;
            previewElement.classList.remove('hidden');
        }
        reader.readAsDataURL(file);
        if (teamType === 'home') homeLogoFile = file;
        else if (teamType === 'away') awayLogoFile = file;
    } else {
        // Nie czyścimy, jeśli nie wybrano pliku, aby zachować obraz z serwera
        if (teamType === 'home') homeLogoFile = null;
        else if (teamType === 'away') awayLogoFile = null;
    }
}

async function saveIntroSettingsData() {
    const formData = new FormData();
    if(introHomeTeamFullNameInput) formData.append('introHomeTeamFullName', introHomeTeamFullNameInput.value);
    if(introAwayTeamFullNameInput) formData.append('introAwayTeamFullName', introAwayTeamFullNameInput.value);
    if(introMatchDateInput) formData.append('introMatchDate', introMatchDateInput.value);
    if(introMatchTimeInput) formData.append('introMatchTime', introMatchTimeInput.value);
    if(introMatchLocationInput) formData.append('introMatchLocation', introMatchLocationInput.value);

    if (homeLogoFile) formData.append('homeLogo', homeLogoFile, 'home_logo.' + homeLogoFile.name.split('.').pop());
    if (awayLogoFile) formData.append('awayLogo', awayLogoFile, 'opponent_logo.' + awayLogoFile.name.split('.').pop());

    try {
        const response = await fetch('/update-intro-settings', { method: 'POST', body: formData });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({message: response.statusText}));
            throw new Error(`Błąd HTTP: ${response.status}. ${errData.message}`);
        }
        alert('Ustawienia Intro zaktualizowane!');
        if(introHomeLogoUploadInput) introHomeLogoUploadInput.value = null; // Clear file input
        if(introAwayLogoUploadInput) introAwayLogoUploadInput.value = null;
        homeLogoFile = null; awayLogoFile = null; // Reset file cache
        loadIntroSettings(); // Reload to show potentially new logo paths from server
    } catch (error) {
        console.error('Błąd zapisu ustawień Intro:', error);
        alert(`Nie udało się zapisać ustawień Intro: ${error.message}`);
    }
}

// OBS Stream Settings
async function populateAudioInputSources() {
    if (!obsConnectionState.connected || !micSelectEl) return;
    try {
        const { inputs } = await obs.call('GetInputList', { inputKind: "wasapi_input_capture" }); // For Windows, adjust for other OS
        // Other kinds: "coreaudio_input_capture" (macOS), "pulse_input_capture" (Linux)
        // You might need to fetch multiple kinds or allow user to specify.
        
        micSelectEl.innerHTML = ''; // Clear existing options
        if (inputs && inputs.length > 0) {
            inputs.forEach(input => {
                if (input.inputName) { // Ensure inputName exists
                    const option = document.createElement('option');
                    option.value = input.inputName;
                    option.textContent = input.inputName;
                    micSelectEl.appendChild(option);
                }
            });
            // Restore selected mic or set to first
            const savedMic = localStorage.getItem('selectedMicName');
            if (savedMic && micSelectEl.querySelector(`option[value="${savedMic}"]`)) {
                micSelectEl.value = savedMic;
            } else if (micSelectEl.options.length > 0) {
                micSelectEl.value = micSelectEl.options[0].value;
                localStorage.setItem('selectedMicName', micSelectEl.value);
            }
        } else {
             micSelectEl.innerHTML = '<option value="">Brak dostępnych mikrofonów</option>';
        }
        // Update mic button based on newly selected/default mic
        // fetchOBSState(); // This might cause a loop if called from fetchOBSState itself.
        // Instead, directly update visuals if mute state is known or fetch it specifically.
        if (micSelectEl.value) { // If a mic is selected (or defaulted)
            const muteStatus = await obs.call('GetInputMute', { inputName: micSelectEl.value });
            obsConnectionState.micMuted = muteStatus.inputMuted;
            updateMicVisuals();
        }


    } catch (error) {
        console.error("Error fetching audio inputs:", error);
        if(micSelectEl) micSelectEl.innerHTML = '<option value="">Błąd ładowania mikrofonów</option>';
    }
}

function setupStreamSettingsControls() {
    if (micSelectEl) {
        micSelectEl.addEventListener('change', async () => {
            localStorage.setItem('selectedMicName', micSelectEl.value);
            // Fetch mute state for the new mic
            if (obsConnectionState.connected && micSelectEl.value) {
                try {
                    const muteStatus = await obs.call('GetInputMute', { inputName: micSelectEl.value });
                    obsConnectionState.micMuted = muteStatus.inputMuted;
                    updateMicVisuals();
                } catch (error) {
                    console.error("Error fetching mute state for new mic:", error);
                }
            }
        });
    }
    if (micToggleBtn) {
        micToggleBtn.addEventListener('click', async () => {
            if (!obsConnectionState.connected) {
                alert('Brak połączenia z OBS.'); return;
            }
            const selectedMic = localStorage.getItem('selectedMicName') || (micSelectEl.options.length > 0 ? micSelectEl.value : null);
            if (!selectedMic) {
                alert('Nie wybrano mikrofonu.'); return;
            }
            try {
                const newMuteState = !obsConnectionState.micMuted;
                await obs.call('SetInputMute', { inputName: selectedMic, inputMuted: newMuteState });
                // OBS event 'InputMuteStateChanged' should update obsConnectionState.micMuted and UI
            } catch (error) {
                console.error("Error toggling mic mute:", error);
                alert('Nie udało się przełączyć mikrofonu.');
            }
        });
    }
    if (bitrateSliderEl && bitrateValueEl) {
        bitrateSliderEl.addEventListener('input', () => {
            bitrateValueEl.textContent = bitrateSliderEl.value;
        });
        // Add logic to actually set bitrate via OBS if API supports it, or save locally
    }
    if (clearPlayersCacheBtn) {
        clearPlayersCacheBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/clear-players-cache', { method: 'POST' });
                if (!response.ok) throw new Error("Błąd serwera podczas czyszczenia cache.");
                alert("Cache zawodników został wyczyszczony. Odśwież listę zawodników, jeśli jest otwarta.");
                allPlayers = []; // Clear local cache too
                // Optionally re-fetch players or prompt user
                if(homePlayersListEl) homePlayersListEl.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">Cache wyczyszczony. Odśwież.</p>';
                if(awayPlayersListEl) awayPlayersListEl.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">Cache wyczyszczony. Odśwież.</p>';

            } catch (error) {
                console.error("Błąd czyszczenia cache zawodników:", error);
                alert("Nie udało się wyczyścić cache zawodników.");
            }
        });
    }
}

// --- OBS CONTROL (Top Bar) ---
function setupOBSControls() {
    if (streamControlBtn) {
        streamControlBtn.addEventListener('click', async () => {
            if (!obsConnectionState.connected) {
                alert('Brak połączenia z OBS.');
                return;
            }
            try {
                if (obsConnectionState.streamActive) {
                    await obs.call('StopStream');
                } else {
                    await obs.call('StartStream');
                }
                // StreamStateChanged event will update the button
            } catch (error) {
                console.error("Error toggling stream:", error);
                alert('Nie udało się zmienić stanu streamu.');
            }
        });
    }
}


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    sidebarButtons = qa('.sidebar-btn');
    tabContents = qa('.tab-content');

    currentTimeEl = el('current-time');
    streamStatusIndicatorEl = el('stream-status-indicator');
    streamStatusTextEl = el('stream-status-text');
    streamControlBtn = el('stream-control-btn');
    streamControlIcon = el('stream-control-icon');
    streamControlText = el('stream-control-text');

    timerDisplayEl = el('timer-display'); // Match Tab Timer Display
    timerEditBtn = el('timer-edit-btn'); // Corrected ID
    timerToggleBtn = el('timer-toggle-btn');
    timerToggleIcon = el('timer-toggle-icon');
    timerToggleText = el('timer-toggle-text');
    timerResetBtn = el('timer-reset-btn');
    timerSetZeroBtn = el('timer-set-zero-btn');
    timerSet45Btn = el('timer-set-45-btn');
    playerSearchInput = el('player-search');
    playerSearchSuggestionsEl = el('player-search-suggestions');
    recentActivitiesListEl = el('recent-activities-list');

    notificationTypesContainer = el('notification-types-container');
    notificationInstructionsEl = el('notification-instructions');
    homePlayersListEl = el('home-players-list');
    awayPlayersListEl = el('away-players-list');
    notificationPreviewEl = el('notification-preview');
    notificationPreviewMessageEl = el('notification-preview-message');
    sendNotificationBtn = el('send-notification-btn');
    previewTeamNameEl = q('#notification-preview .team-header .name span'); // Corrected selector for preview
    previewChangeLabelEl = q('#notification-preview .change-header span'); // Corrected selector for preview
    previewPlayerOutEl = q('#notification-preview .player.out');
    previewPlayerInEl = q('#notification-preview .player.in');


    scoreHomeDisplay = el('home-score'); // Score Tab Score Display
    scoreAwayDisplay = el('away-score'); // Score Tab Score Display
    scoreHomeNameDisplay = el('score-home-team-name-display');
    scoreAwayNameDisplay = el('score-away-team-name-display');

    homeTeamNameScorebugInput = el('home-team-name-scorebug');
    awayTeamNameScorebugInput = el('away-team-name-scorebug');
    homeScoreBugInput = el('home-score-bug');
    awayScoreBugInput = el('away-score-bug');
    homeTeamColorInput = el('home-team-color');
    awayTeamColorInput = el('away-team-color');
    teamBackgroundColorInput = el('team-background');
    goalsBackgroundColorInput = el('goals-background');
    timeBackgroundColorInput = el('time-background');
    teamTextColorInput = el('team-text-color');
    goalsTextColorInput = el('goals-text-color');
    timeTextColorInput = el('time-text-color');
    homeHexEl = el('home-hex');
    awayHexEl = el('away-hex');
    teamBackgroundHexEl = el('team-background-hex');
    goalsBackgroundHexEl = el('goals-background-hex');
    timeBackgroundHexEl = el('time-background-hex');
    teamTextColorHexEl = el('team-text-color-hex');
    goalsTextColorHexEl = el('goals-text-color-hex');
    timeTextColorHexEl = el('time-text-color-hex');
    updateScorebugBtn = el('update-scorebug-btn');

    introHomeTeamFullNameInput = el('intro-home-team-full-name');
    introAwayTeamFullNameInput = el('intro-away-team-full-name');
    introMatchDateInput = el('intro-match-date');
    introMatchTimeInput = el('intro-match-time');
    introMatchLocationInput = el('intro-match-location');
    introHomeLogoUploadInput = el('intro-home-logo-upload');
    previewHomeLogoImg = el('preview-home-logo');
    introAwayLogoUploadInput = el('intro-away-logo-upload');
    previewAwayLogoImg = el('preview-away-logo');
    updateIntroSettingsBtn = el('update-intro-settings-btn');

    micSelectEl = el('mic-select');
    micToggleBtn = el('mic-toggle-btn');
    micIconEl = el('mic-icon');
    cameraSelectEl = el('camera-select');
    bitrateSliderEl = el('bitrate-slider');
    bitrateValueEl = el('bitrate-value');
    clearPlayersCacheBtn = el('clear-players-cache-btn');

    quickNotificationModal = el('quick-notification-modal');
    closeQuickNotificationModalBtn = el('close-quick-notification-modal-btn');
    quickPlayerInfoEl = el('quick-player-info');
    quickNotifBtns = qa('#quick-notification-modal .quick-notif-btn');
    quickChangeSelectContainer = el('quick-change-select');
    quickChangePlayerInSelect = el('quick-change-player-in');
    quickSendBtn = el('quick-send-btn');

    repeatActivityModal = el('repeat-activity-modal');
    closeRepeatActivityModalBtn = el('close-repeat-activity-modal-btn'); // Corrected ID
    repeatActivityInfoEl = el('repeat-activity-info');
    repeatActivityBtn = el('repeat-activity-btn');
    repeatActivityNewBtn = el('repeat-activity-new-btn');

    // Setup UI and event listeners
    setupTabs();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    connectToOBS(); // Initial connection attempt

    setupTimerControls();
    setupScoreControls();
    loadPlayers(); // Load player data for notifications and quick actions
    setupNotificationControls();
    setupSceneControls();
    
    // Settings Tab
    loadScorebugSettings();
    setupScorebugSettingsControls();
    loadIntroSettings();
    setupIntroSettingsControls();
    setupStreamSettingsControls(); // Includes populating mic list

    // Modals & Quick Actions
    setupQuickActions();
    setupQuickNotificationModalActions();
    setupRepeatActivityModalActions();
    setupOBSControls();


    // Load recent activities from localStorage
    const storedActivities = localStorage.getItem('streamPanelRecentActivities');
    if (storedActivities) {
        try {
            recentActivities = JSON.parse(storedActivities);
        } catch (e) { recentActivities = []; }
    }
    renderRecentActivitiesUI();

    // Initial fetch for timer state from server (after OBS connection attempt)
    fetch('/timer-state')
        .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(data => {
            isTimerRunning = data.running; // Ustawienie isTimerRunning na podstawie odpowiedzi serwera
            updateTimerToggleButtonUI(isTimerRunning);
            updateTimerDisplayUI(data.minute, data.second);
        })
        .catch(err => console.error("Error fetching initial timer state:", err));
    
    // Initial fetch for scorebug data to populate score display
    fetch('/initial-settings') // This endpoint returns scorebug data
        .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(data => {
            homeScore = data.homeScore || 0;
            awayScore = data.awayScore || 0;
            if(scoreHomeDisplay) scoreHomeDisplay.textContent = homeScore;
            if(scoreAwayDisplay) scoreAwayDisplay.textContent = awayScore;
            if(scoreHomeNameDisplay) scoreHomeNameDisplay.textContent = data.homeName || 'Gospodarze';
            if(scoreAwayNameDisplay) scoreAwayNameDisplay.textContent = data.awayName || 'Goście';
        })
        .catch(err => console.error("Error fetching initial score for display:", err));

});
