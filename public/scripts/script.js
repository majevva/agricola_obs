// --- ZMIENNE GLOBALNE ---
let homeScore = 0;
let awayScore = 0;
let selectedPlayers = []; 
let notificationType = 'change'; 
let notificationTeam = 'home'; 
let allPlayers = []; 
let recentActivities = []; 
const MAX_RECENT_ACTIVITIES = 8;

let isTimerRunning = false;
let obsFrontendState = { 
    micMuted: true, 
    streamActive: false,
    obsConnected: false, 
    selectedMicNameBackend: 'Mikrofon' 
}; 

let homeLogoFile = null;
let awayLogoFile = null;

// Elementy DOM 
let sidebarButtons, tabContents;
let currentTimeEl, streamStatusIndicatorEl, streamStatusTextEl, streamControlBtn, streamControlIcon, streamControlText;
let timerDisplayEl, timerEditBtn, timerToggleBtn, timerToggleIcon, timerToggleText, timerResetBtn, timerSetZeroBtn, timerSet45Btn;
let playerSearchInput, playerSearchSuggestionsEl, recentActivitiesListEl;
let notificationTypesContainer, notificationInstructionsEl, homePlayersListEl, awayPlayersListEl;
let notificationPreviewEl, notificationPreviewMessageEl, sendNotificationBtn;
let previewTeamNameEl, previewChangeLabelEl, previewPlayerOutEl, previewPlayerInEl; 
let scoreHomeDisplay, scoreAwayDisplay, scoreHomeNameDisplay, scoreAwayNameDisplay;
let homeTeamNameScorebugInput, awayTeamNameScorebugInput, homeScoreBugInput, awayScoreBugInput;
let homeTeamColorInput, awayTeamColorInput, teamBackgroundColorInput, goalsBackgroundColorInput, timeBackgroundColorInput;
let teamTextColorInput, goalsTextColorInput, timeTextColorInput;
let homeHexEl, awayHexEl, teamBackgroundHexEl, goalsBackgroundHexEl, timeBackgroundHexEl;
let teamTextColorHexEl, goalsTextColorHexEl, timeTextColorHexEl;
let updateScorebugBtn;
let introHomeTeamFullNameInput, introAwayTeamFullNameInput, introMatchDateInput, introMatchTimeInput, introMatchLocationInput;
let introHomeLogoUploadInput, previewHomeLogoImg, introAwayLogoUploadInput, previewAwayLogoImg;
let updateIntroSettingsBtn;
let micSelectEl, micToggleBtn, micIconEl, cameraSelectEl, bitrateSliderEl, bitrateValueEl;
let clearPlayersCacheBtn;
let quickNotificationModal, closeQuickNotificationModalBtn, quickPlayerInfoEl, quickNotifBtns, quickChangeSelectContainer, quickChangePlayerInSelect, quickSendBtn;
let repeatActivityModal, closeRepeatActivityModalBtn, repeatActivityInfoEl, repeatActivityBtn, repeatActivityNewBtn;

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
  if (num === null || typeof num === 'undefined') return '0'.repeat(size); // Zabezpieczenie
  return num.toString().padStart(size, '0');
}

function formatTimestampToTime(timestamp) {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// --- OBS STATUS & CONTROL (via Backend) ---
async function fetchOBSBackendState() {
    try {
        const response = await fetch('/obs-status'); 
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('/obs-status endpoint not found on server.');
                 updateStreamStatusIndicator(false, 'Błąd konfiguracji serwera (brak /obs-status)');
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            obsFrontendState.obsConnected = false;
            obsFrontendState.streamActive = false;
            obsFrontendState.micMuted = true; 
        } else {
            const data = await response.json();
            obsFrontendState.obsConnected = data.obsConnected;
            obsFrontendState.streamActive = data.streamActive;
            obsFrontendState.micMuted = data.micMuted !== undefined ? data.micMuted : true; 
            obsFrontendState.selectedMicNameBackend = data.selectedMicName || 'Mikrofon'; 

            updateStreamStatusIndicator(obsFrontendState.obsConnected, data.obsStatusText);
        }

        updateStreamControlButton();
        updateMicVisuals(); 

        if (obsFrontendState.obsConnected) {
            populateAudioInputSources(); 
        } else {
            if(micSelectEl) micSelectEl.innerHTML = '<option value="">OBS niepołączony</option>';
        }

    } catch (error) {
        console.error('Error fetching OBS state from backend:', error);
        updateStreamStatusIndicator(false, 'Błąd odczytu statusu OBS');
        obsFrontendState.obsConnected = false; 
        obsFrontendState.streamActive = false;
        obsFrontendState.micMuted = true;
        updateStreamControlButton();
        updateMicVisuals();
        if(micSelectEl) micSelectEl.innerHTML = '<option value="">Błąd serwera</option>';
    }
}


// --- UI UPDATES ---
function updateStreamStatusIndicator(connectedToOBSByBackend, statusTextFromServer = null) {
    if (!streamStatusIndicatorEl || !streamStatusTextEl) return;
    
    if (connectedToOBSByBackend) {
        streamStatusIndicatorEl.classList.remove('bg-red-500', 'bg-yellow-500');
        streamStatusIndicatorEl.classList.add('bg-green-500', 'pulse');
        streamStatusTextEl.textContent = statusTextFromServer || 'OBS: POŁĄCZONO';
        streamStatusTextEl.classList.remove('text-red-400', 'text-yellow-400');
        streamStatusTextEl.classList.add('text-green-400');
    } else {
        streamStatusIndicatorEl.classList.remove('bg-green-500', 'pulse');
        streamStatusTextEl.classList.remove('text-green-400');
        if (statusTextFromServer && statusTextFromServer.toUpperCase().includes('BŁĄD')) { 
            streamStatusIndicatorEl.classList.add('bg-yellow-500'); 
            streamStatusTextEl.textContent = statusTextFromServer;
            streamStatusTextEl.classList.add('text-yellow-400');
        } else {
            streamStatusIndicatorEl.classList.add('bg-red-500'); 
            streamStatusTextEl.textContent = statusTextFromServer || 'OBS: BRAK POŁĄCZENIA';
            streamStatusTextEl.classList.add('text-red-400');
        }
    }
}

function updateStreamControlButton() {
    if (!streamControlBtn || !streamControlIcon || !streamControlText) return;
    streamControlBtn.disabled = !obsFrontendState.obsConnected; 

    if (obsFrontendState.streamActive) {
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
    if (timerDisplayEl && !timerDisplayEl.querySelector('input')) { 
        timerDisplayEl.textContent = `${pad(minutes)}:${pad(seconds)}`;
    }
}

function updateTimerToggleButtonUI(running) {
    if (!timerToggleBtn || !timerToggleIcon || !timerToggleText) return;
    isTimerRunning = running; 
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
    if (!micToggleBtn || !micIconEl || !micSelectEl) return;
    
    const userSelectedMicName = localStorage.getItem('selectedMicName') || micSelectEl.value || obsFrontendState.selectedMicNameBackend;
    
    micToggleBtn.disabled = !obsFrontendState.obsConnected || !micSelectEl.value; 

    if (obsFrontendState.micMuted) {
        micToggleBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        micToggleBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        micIconEl.classList.remove('fa-microphone');
        micIconEl.classList.add('fa-microphone-slash');
        micToggleBtn.setAttribute('aria-label', `Włącz mikrofon: ${userSelectedMicName}`);
    } else {
        micToggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        micToggleBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        micIconEl.classList.remove('fa-microphone-slash');
        micIconEl.classList.add('fa-microphone');
        micToggleBtn.setAttribute('aria-label', `Wycisz mikrofon: ${userSelectedMicName}`);
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

// --- TIMER LOGIC (via Backend) ---
async function handleTimerAction(action, minutes = null, seconds = null) {
    try {
        const payload = { action };
        if (minutes !== null) payload.minute = pad(minutes);
        if (seconds !== null) payload.second = pad(seconds);

        const response = await fetch('/update-time', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) { 
             const errorText = await response.text(); 
             throw new Error(`Błąd serwera: ${response.status} ${response.statusText}. ${errorText}`);
        }
        
        const data = await response.json(); 
        updateTimerToggleButtonUI(data.running); 
        updateTimerDisplayUI(data.minute, data.second); 

    } catch (error) {
        console.error(`Error ${action} timer:`, error);
        alert(`Nie udało się wykonać akcji timera: ${action}. ${error.message}`);
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
        if (timerDisplayEl.querySelector('input')) return; 

        const currentText = timerDisplayEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'text-5xl font-mono font-bold text-center text-white bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded';
        
        timerDisplayEl.innerHTML = ''; 
        timerDisplayEl.appendChild(input);
        input.focus();
        input.select();

        const finalizeEdit = async (save) => { 
            const newTime = input.value.trim();
            let shouldRestoreOriginal = true;

            if (timerDisplayEl.contains(input)) {
                 timerDisplayEl.removeChild(input);
            }
            
            if (save && /^\d{1,2}:\d{2}$/.test(newTime)) {
                const [min, sec] = newTime.split(':').map(Number);
                await handleTimerAction('set', min, sec); 
                // Po udanej odpowiedzi serwera, UI zostanie zaktualizowane przez handleTimerAction
                shouldRestoreOriginal = false; // Nie przywracaj, bo serwer zaktualizuje
            } else if (save) {
                alert('Nieprawidłowy format czasu. Użyj MM:SS.');
            }
            
            if (shouldRestoreOriginal) {
                timerDisplayEl.textContent = currentText; 
            }
        };

        input.addEventListener('blur', () => {
            setTimeout(() => {
                 if (document.activeElement !== input && timerDisplayEl.contains(input)) { 
                    finalizeEdit(false); 
                 } else if (!timerDisplayEl.contains(input) && document.activeElement !== input) {
                    // Input already removed, do nothing
                 }
            }, 100);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                finalizeEdit(true);
            }
            if (e.key === 'Escape') {
                 e.preventDefault();
                 finalizeEdit(false);
            }
        });
    });
}

// --- Funkcja do cyklicznego pobierania stanu timera ---
async function fetchAndUpdateTimerState() {
    try {
        const response = await fetch('/timer-state'); // Endpoint zdefiniowany w server.js
        if (!response.ok) {
            // Nie rzucaj błędem, który zatrzyma interwał, ale zaloguj problem
            console.warn(`Błąd pobierania stanu timera: ${response.status} ${response.statusText}`);
            return; 
        }
        const data = await response.json();
        if (data && data.minute !== undefined && data.second !== undefined) {
            updateTimerDisplayUI(data.minute, data.second);
            // Można też zaktualizować isTimerRunning i przycisk, jeśli serwer zwraca 'running'
            if (data.running !== undefined) {
                 updateTimerToggleButtonUI(data.running);
            }
        }
    } catch (error) {
        console.error('Nie udało się pobrać stanu timera:', error);
    }
}


// --- SCORE LOGIC (via Backend) ---
async function updateScore(team, delta) {
    const currentScore = team === 'home' ? homeScore : awayScore;
    const newScore = Math.max(0, currentScore + delta);

    if (team === 'home') homeScore = newScore;
    else awayScore = newScore;
    if (scoreHomeDisplay) scoreHomeDisplay.textContent = homeScore;
    if (scoreAwayDisplay) scoreAwayDisplay.textContent = awayScore;
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
        if (team === 'home') homeScore -= delta; else awayScore -= delta;
        if (scoreHomeDisplay) scoreHomeDisplay.textContent = homeScore;
        if (scoreAwayDisplay) scoreAwayDisplay.textContent = awayScore;
        alert('Nie udało się zaktualizować wyniku na serwerze.');
    }
}

function setupScoreControls() {
    qa('#score-tab .update-score-btn').forEach(button => { 
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
        allPlayers.sort((a,b) => a.displayName.localeCompare(b.displayName)); 

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
    listElement.innerHTML = ''; 
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
                const firstSelected = selectedPlayers.shift();
                const firstSelectedEl = qa(`#notifications-tab .player-item.selected[data-team='${firstSelected.team}'][data-number='${firstSelected.number}']`); // Uściślenie
                if (firstSelectedEl.length > 0) firstSelectedEl[0].classList.remove('selected');
            }
        } else { 
            if (selectedPlayers.length > 0) {
                const prevSelected = selectedPlayers.pop();
                const prevSelectedEl = qa(`#notifications-tab .player-item.selected[data-team='${prevSelected.team}'][data-number='${prevSelected.number}']`); // Uściślenie
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
    const type = notificationType; 
    if (type === 'change') notificationInstructionsEl.textContent = 'Wybierz dwóch zawodników z tej samej drużyny (pierwszy schodzi, drugi wchodzi).';
    else if (type === 'yellow-card') notificationInstructionsEl.textContent = 'Wybierz zawodnika, który otrzymał żółtą kartkę.';
    else if (type === 'red-card') notificationInstructionsEl.textContent = 'Wybierz zawodnika, który otrzymał czerwoną kartkę.';
    else if (type === 'injury') notificationInstructionsEl.textContent = 'Wybierz kontuzjowanego zawodnika.';
    else if (type === 'goal') notificationInstructionsEl.textContent = 'Wybierz strzelca bramki.';
    else notificationInstructionsEl.textContent = 'Wybierz typ powiadomienia i zawodników.';
}

function clearAllPlayerSelections() {
    qa('#notifications-tab .player-item.selected').forEach(el => el.classList.remove('selected')); 
    selectedPlayers = [];
    updateUINotificationPreview(); 
}

function setupNotificationControls() {
    if (notificationTypesContainer) {
        notificationTypesContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.notification-type-btn');
            if (button) {
                qa('#notifications-tab .notification-type-btn').forEach(btn => btn.classList.remove('active', 'border-indigo-500', 'shadow-lg')); 
                button.classList.add('active', 'border-indigo-500', 'shadow-lg');
                notificationType = button.dataset.type;
                updateNotificationInstructionsUI();
                clearAllPlayerSelections(); 
            }
        });
    }
    if (sendNotificationBtn) {
        sendNotificationBtn.addEventListener('click', sendUINotification);
    }
    const defaultNotifBtn = q('#notifications-tab .notification-type-btn[data-type="change"]');
    if (defaultNotifBtn) {
        defaultNotifBtn.click(); 
    } else if (qa('#notifications-tab .notification-type-btn').length > 0) {
        qa('#notifications-tab .notification-type-btn')[0].click();
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
    
    notificationTeam = playerOut.team; 

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
    let outIconHtml = '➡️'; 
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

    try {
        const settingsRes = await fetch('/initial-settings'); 
        const settings = await settingsRes.json();
        
        previewTeamNameEl.textContent = notificationTeam === 'home' ? (settings.homeName || 'GOSPODARZE') : (settings.awayName || 'GOŚCIE');
        const teamHeaderColorDiv = q('#notification-preview .team-header .color');
        if (teamHeaderColorDiv) teamHeaderColorDiv.style.backgroundColor = notificationTeam === 'home' ? settings.homeColor : settings.awayColor;
        
        const teamHeaderDiv = q('#notification-preview .team-header');
        if(teamHeaderDiv) teamHeaderDiv.style.backgroundColor = settings.teamBackground;
        if(previewTeamNameEl) previewTeamNameEl.style.color = settings.teamTextColor;

        const changeHeaderDiv = q('#notification-preview .change-header');
        if(changeHeaderDiv) {
            changeHeaderDiv.style.backgroundColor = settings.goalsBackground;
            changeHeaderDiv.style.color = settings.goalsTextColor;
        }
        
        if(previewPlayerOutEl) {
            previewPlayerOutEl.style.backgroundColor = settings.teamBackground; 
            previewPlayerOutEl.style.color = settings.teamTextColor;
        }
        if(playerIn && previewPlayerInEl){ 
            previewPlayerInEl.style.backgroundColor = settings.teamTextColor; 
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
        team: selectedPlayers[0].team, 
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
        
        addRecentActivityUI(data); 
        clearAllPlayerSelections(); 
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
    
    currentQuickNotificationType = null;
    currentQuickPlayerIn = null;
    if(quickChangeSelectContainer) quickChangeSelectContainer.classList.add('hidden');
    if(quickSendBtn) quickSendBtn.disabled = true;
    if(quickNotifBtns) quickNotifBtns.forEach(btn => btn.classList.remove('bg-indigo-500', 'ring-2', 'ring-indigo-400'));

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
                    if(quickSendBtn) quickSendBtn.disabled = !quickChangePlayerInSelect.value; 
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
                playerOut: currentQuickPlayer, 
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
    quickChangePlayerInSelect.innerHTML = '<option value="">Wybierz...</option>'; 
    teamPlayers.forEach(p => {
        const option = document.createElement('option');
        option.value = p.number;
        option.textContent = p.displayName;
        quickChangePlayerInSelect.appendChild(option);
    });
    currentQuickPlayerIn = null; 
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
    recentActivitiesListEl.innerHTML = ''; 

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
            const repeatData = { ...currentRepeatActivity, timestamp: Date.now() }; 
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
            currentQuickPlayer = currentRepeatActivity.playerOut; 
            repeatActivityModal.classList.add('hidden');
            showQuickNotificationModalUI(); 
        };
    }
}


// --- SCENES (via Backend) ---
function setupSceneControls() {
    qa('.switch-scene-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const sceneName = button.dataset.sceneName;
            try {
                const response = await fetch('/switch-scene', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sceneName })
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(()=>({message: `Błąd serwera: ${response.statusText}`}));
                    throw new Error(errorData.message || `Błąd przełączania sceny na serwerze: ${response.statusText}`);
                }
                console.log(`Wysłano żądanie przełączenia na scenę: ${sceneName}`);
            } catch (error) {
                console.error(`Błąd przełączania na scenę ${sceneName}:`, error);
                alert(`Nie udało się przełączyć na scenę: ${sceneName}. (${error.message})`);
            }
        });
    });
}

// --- SETTINGS ---
// Scorebug Settings (via Backend)
function loadScorebugSettings() {
    const defaults = { 
        homeColor: '#C8102E', awayColor: '#1B449C', teamBackground: '#34003A',
        goalsBackground: '#00FC8A', timeBackground: '#FFFFFF', teamTextColor: '#FFFFFF',
        goalsTextColor: '#34003A', timeTextColor: '#34003A',
        homeName: 'GOSPODARZE', awayName: 'GOŚCIE', homeScore: 0, awayScore: 0
    };

    fetch('/initial-settings') 
        .then(res => res.ok ? res.json() : Promise.resolve(defaults)) 
        .then(settings => {
            const s = { ...defaults, ...settings }; 
            if (homeTeamNameScorebugInput) homeTeamNameScorebugInput.value = s.homeName;
            if (awayTeamNameScorebugInput) awayTeamNameScorebugInput.value = s.awayName;
            if (homeScoreBugInput) homeScoreBugInput.value = s.homeScore;
            if (awayScoreBugInput) awayScoreBugInput.value = s.awayScore;

            if (homeTeamColorInput) homeTeamColorInput.value = s.homeColor;
            if (awayTeamColorInput) awayTeamColorInput.value = s.awayColor;
            if (teamBackgroundColorInput) teamBackgroundColorInput.value = s.teamBackground;
            if (goalsBackgroundColorInput) goalsBackgroundColorInput.value = s.goalsBackground;
            if (timeBackgroundColorInput) timeBackgroundColorInput.value = s.timeBackground;
            if (teamTextColorInput) teamTextColorInput.value = s.teamTextColor;
            if (goalsTextColorInput) goalsTextColorInput.value = s.goalsTextColor;
            if (timeTextColorInput) timeTextColorInput.value = s.timeTextColor;
            updateHexDisplays();
        })
        .catch(error => {
            console.error("Błąd ładowania ustawień scorebuga, używam domyślnych:", error);
            if (homeTeamNameScorebugInput) homeTeamNameScorebugInput.value = defaults.homeName;
            if (awayTeamNameScorebugInput) awayTeamNameScorebugInput.value = defaults.awayName;
            if (homeScoreBugInput) homeScoreBugInput.value = defaults.homeScore;
            if (awayScoreBugInput) awayScoreBugInput.value = defaults.awayScore;
            if (homeTeamColorInput) homeTeamColorInput.value = defaults.homeColor;
            // ... i tak dalej dla pozostałych domyślnych kolorów ...
            updateHexDisplays();
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

// Intro Settings (via Backend)
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
        if(introHomeLogoUploadInput) introHomeLogoUploadInput.value = null; 
        if(introAwayLogoUploadInput) introAwayLogoUploadInput.value = null;
        homeLogoFile = null; awayLogoFile = null; 
        loadIntroSettings(); 
    } catch (error) {
        console.error('Błąd zapisu ustawień Intro:', error);
        alert(`Nie udało się zapisać ustawień Intro: ${error.message}`);
    }
}

// OBS Stream Settings (Interaction via Backend)
async function populateAudioInputSources() {
    if (!obsFrontendState.obsConnected || !micSelectEl) { 
        if(micSelectEl) micSelectEl.innerHTML = '<option value="">OBS niepołączony</option>';
        return;
    }
    try {
        const response = await fetch('/obs-audio-inputs'); 
        if (!response.ok) throw new Error('Błąd pobierania listy mikrofonów z serwera');
        
        const data = await response.json(); 
        const inputs = data.inputs || []; 
        
        micSelectEl.innerHTML = ''; 
        if (inputs && inputs.length > 0) {
            inputs.forEach(input => {
                if (input.inputName) { 
                    const option = document.createElement('option');
                    option.value = input.inputName;
                    option.textContent = input.inputName;
                    micSelectEl.appendChild(option);
                }
            });
            const savedMic = localStorage.getItem('selectedMicName');
            const currentBackendMic = obsFrontendState.selectedMicNameBackend;

            if (savedMic && micSelectEl.querySelector(`option[value="${savedMic}"]`)) {
                micSelectEl.value = savedMic;
            } else if (currentBackendMic && micSelectEl.querySelector(`option[value="${currentBackendMic}"]`)) {
                micSelectEl.value = currentBackendMic; 
                localStorage.setItem('selectedMicName', currentBackendMic);
            } else if (micSelectEl.options.length > 0) {
                micSelectEl.value = micSelectEl.options[0].value;
                localStorage.setItem('selectedMicName', micSelectEl.value);
            }
        } else {
             micSelectEl.innerHTML = '<option value="">Brak mikrofonów</option>';
        }
        updateMicVisuals(); 

    } catch (error) {
        console.error("Error fetching audio inputs via backend:", error);
        if(micSelectEl) micSelectEl.innerHTML = '<option value="">Błąd ładowania</option>';
    }
}

function setupStreamSettingsControls() {
    if (micSelectEl) {
        micSelectEl.addEventListener('change', async () => {
            localStorage.setItem('selectedMicName', micSelectEl.value);
            await fetchOBSBackendState(); 
        });
    }
    if (micToggleBtn) {
        micToggleBtn.addEventListener('click', async () => {
            const selectedMic = localStorage.getItem('selectedMicName') || (micSelectEl.options.length > 0 ? micSelectEl.value : null);
            if (!obsFrontendState.obsConnected || !selectedMic) {
                alert(!obsFrontendState.obsConnected ? 'Brak połączenia z OBS.' : 'Nie wybrano mikrofonu.'); 
                return;
            }
            try {
                const newMuteState = !obsFrontendState.micMuted;
                const response = await fetch('/toggle-mic', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ inputName: selectedMic, mute: newMuteState })
                });
                if (!response.ok) {
                     const errorData = await response.json().catch(()=>({message: `Błąd serwera: ${response.statusText}`}));
                    throw new Error(errorData.message || `Błąd przełączania mikrofonu na serwerze`);
                }
                const data = await response.json();
                obsFrontendState.micMuted = data.muted; 
                updateMicVisuals();
            } catch (error) {
                console.error("Error toggling mic mute via backend:", error);
                alert(`Nie udało się przełączyć mikrofonu: ${error.message}`);
            }
        });
    }
    if (bitrateSliderEl && bitrateValueEl) {
        bitrateSliderEl.addEventListener('input', () => {
            bitrateValueEl.textContent = bitrateSliderEl.value;
        });
    }
    if (clearPlayersCacheBtn) {
        clearPlayersCacheBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/clear-players-cache', { method: 'POST' });
                if (!response.ok) throw new Error("Błąd serwera podczas czyszczenia cache.");
                alert("Cache zawodników został wyczyszczony. Odśwież listę zawodników, jeśli jest otwarta.");
                allPlayers = []; 
                if(homePlayersListEl) homePlayersListEl.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">Cache wyczyszczony. Odśwież.</p>';
                if(awayPlayersListEl) awayPlayersListEl.innerHTML = '<p class="text-slate-500 text-sm text-center py-4">Cache wyczyszczony. Odśwież.</p>';
            } catch (error) {
                console.error("Błąd czyszczenia cache zawodników:", error);
                alert("Nie udało się wyczyścić cache zawodników.");
            }
        });
    }
}

// --- OBS CONTROL (Top Bar - via Backend) ---
function setupOBSControls() {
    if (streamControlBtn) {
        streamControlBtn.addEventListener('click', async () => {
            const action = obsFrontendState.streamActive ? 'stop-stream' : 'start-stream';
            try {
                const response = await fetch(`/${action}`, { method: 'POST' }); 
                if (!response.ok) {
                     const errorData = await response.json().catch(()=>({message: `Błąd serwera: ${response.statusText}`}));
                    throw new Error(errorData.message || `Błąd ${action} na serwerze`);
                }
                await fetchOBSBackendState();
            } catch (error) {
                console.error(`Error ${action} via backend:`, error);
                alert(`Nie udało się wykonać akcji ${action}: ${error.message}`);
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

    timerDisplayEl = el('timer-display'); 
    timerEditBtn = el('timer-edit-btn'); 
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
    previewTeamNameEl = q('#notification-preview .team-header .name span'); 
    previewChangeLabelEl = q('#notification-preview .change-header span'); 
    previewPlayerOutEl = q('#notification-preview .player.out');
    previewPlayerInEl = q('#notification-preview .player.in');

    scoreHomeDisplay = el('home-score'); 
    scoreAwayDisplay = el('away-score'); 
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
    closeRepeatActivityModalBtn = el('close-repeat-activity-modal-btn'); 
    repeatActivityInfoEl = el('repeat-activity-info');
    repeatActivityBtn = el('repeat-activity-btn');
    repeatActivityNewBtn = el('repeat-activity-new-btn');

    // Setup UI and event listeners
    setupTabs();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    fetchOBSBackendState(); 
    setInterval(fetchOBSBackendState, 5000); 

    setupTimerControls();
    setupScoreControls();
    loadPlayers(); 
    setupNotificationControls();
    setupSceneControls();
    
    loadScorebugSettings();
    setupScorebugSettingsControls();
    loadIntroSettings();
    setupIntroSettingsControls();
    setupStreamSettingsControls(); 

    setupQuickActions();
    setupQuickNotificationModalActions();
    setupRepeatActivityModalActions();
    setupOBSControls();

    const storedActivities = localStorage.getItem('streamPanelRecentActivities');
    if (storedActivities) {
        try {
            recentActivities = JSON.parse(storedActivities);
        } catch (e) { recentActivities = []; }
    }
    renderRecentActivitiesUI();

    // Initial fetch for timer state from server
    fetchAndUpdateTimerState(); // Wywołaj raz na starcie
    setInterval(fetchAndUpdateTimerState, 1000); // I potem cyklicznie
    
    fetch('/initial-settings') 
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
