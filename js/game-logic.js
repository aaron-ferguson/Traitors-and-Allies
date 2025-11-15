// ==================== MENU NAVIGATION ====================

function showCreateGame() {
// Hide menu, show setup phase
document.getElementById('main-menu').classList.add('hidden');
document.getElementById('setup-phase').classList.remove('hidden');
}

function showJoinGame() {
// Show the join game input section on the menu
document.getElementById('join-game-section').classList.remove('hidden');
}

function hideJoinGame() {
// Hide the join game input section
document.getElementById('join-game-section').classList.add('hidden');
document.getElementById('menu-room-code-input').value = '';
}

async function joinGameFromMenu() {
const roomCodeInput = document.getElementById('menu-room-code-input');
const roomCode = roomCodeInput.value.trim().toUpperCase();

if (roomCode.length !== 4) {
alert('Please enter a valid 4-letter room code.');
return;
}

if (!supabaseClient) {
alert('Online multiplayer not available. Please configure Supabase.');
return;
}

// Try to join the game from database
const gameData = await joinGameFromDB(roomCode);

if (gameData) {
// Successfully found game - hide menu, show waiting room
document.getElementById('main-menu').classList.add('hidden');
document.getElementById('setup-phase').classList.add('hidden');
document.getElementById('waiting-room').classList.remove('hidden');
document.getElementById('room-code').textContent = roomCode;

// Update displays
document.getElementById('min-players-display').textContent = gameState.settings.minPlayers;
document.getElementById('max-players-display').textContent = gameState.settings.maxPlayers;
document.getElementById('imposter-count-display').textContent = gameState.settings.imposterCount;

// Generate QR code
generateQRCode();
updateJoinSection();
updateLobby();
} else {
alert(`Game with room code "${roomCode}" not found. Please check the code and try again.`);
}
}

function returnToMenu() {
// Stop player existence polling
if (playerExistenceInterval) {
clearInterval(playerExistenceInterval);
playerExistenceInterval = null;
}

// Unsubscribe from channels FIRST to prevent callbacks from firing
unsubscribeFromChannels();

// Clear player state
myPlayerName = null;
isGameCreator = false;

// Clear game state
gameState = {
stage: 'setup',
roomCode: '',
hostName: null,
settings: {
minPlayers: 4,
maxPlayers: 10,
tasksPerPlayer: 3,
imposterCount: 1,
eliminationCooldown: 30,
cooldownReduction: 5,
meetingRoom: '',
meetingLimit: 3,
meetingTimer: 60,
additionalRules: '',
selectedRooms: {}
},
players: [],
currentPlayer: null,
roleRevealed: false,
meetingsUsed: 0,
meetingCaller: null,
meetingType: null,
gameEnded: false,
winner: null
};

// Hide all phases, show menu
document.getElementById('setup-phase').classList.add('hidden');
document.getElementById('waiting-room').classList.add('hidden');
document.getElementById('game-phase').classList.add('hidden');
document.getElementById('main-menu').classList.remove('hidden');

// Hide join section
hideJoinGame();
}

// =================================================================

function generateRoomCode() {
const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let code = '';
for (let i = 0; i < 4; i++) {
code += characters.charAt(Math.floor(Math.random() * characters.length));
}
return code;
}

function getGameURL() {
const baseUrl = window.location.origin + window.location.pathname;
return `${baseUrl}?room=${gameState.roomCode}`;
}

function copyGameURL() {
const url = getGameURL();
navigator.clipboard.writeText(url).then(() => {
const feedback = document.getElementById('copy-feedback');
feedback.style.opacity = '1';
setTimeout(() => feedback.style.opacity = '0', 2000);
});
}

function generateQRCode() {
const url = getGameURL();
const qrCodeImage = document.getElementById('qr-code-image');
// Use QR Server API to generate QR code
const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
qrCodeImage.src = qrApiUrl;
}

async function createGame() {
// Gather settings
gameState.settings.minPlayers = parseInt(document.getElementById('min-players').value);
gameState.settings.maxPlayers = parseInt(document.getElementById('max-players').value);
gameState.settings.tasksPerPlayer = parseInt(document.getElementById('tasks-per-player').value);
gameState.settings.imposterCount = parseInt(document.getElementById('imposter-count').value);
gameState.settings.eliminationCooldown = parseInt(document.getElementById('elimination-cooldown').value);
gameState.settings.cooldownReduction = parseInt(document.getElementById('cooldown-reduction').value);
gameState.settings.meetingRoom = document.getElementById('meeting-room').value;
gameState.settings.meetingLimit = parseInt(document.getElementById('meeting-limit').value);
gameState.settings.meetingTimer = parseInt(document.getElementById('meeting-timer').value);
gameState.settings.additionalRules = document.getElementById('additional-rules').value;

// Validation
if (gameState.settings.minPlayers > gameState.settings.maxPlayers) {
alert('Minimum players cannot be greater than maximum players!');
return;
}

if (!gameState.settings.meetingRoom) {
alert('Please select a meeting room!');
return;
}

// Mark this device as the game creator FIRST (before any UI updates that check host status)
isGameCreator = true;
console.log('Game created - isGameCreator set to true');

// Generate room code
gameState.roomCode = generateRoomCode();
document.getElementById('room-code').textContent = gameState.roomCode;

// Update displays
document.getElementById('min-players-display').textContent = gameState.settings.minPlayers;
document.getElementById('max-players-display').textContent = gameState.settings.maxPlayers;
document.getElementById('imposter-count-display').textContent = gameState.settings.imposterCount;

// Check if this is a new game after a previous one (need to send invitations)
const isNewGameAfterPrevious = gameState.isNewGameAfterPrevious || false;

if (isNewGameAfterPrevious && supabaseClient && currentGameId) {
console.log('This is a new game after previous - sending invitations');

// Send invitation to players from previous game
try {
await supabaseClient
.from('games')
.update({
settings: {
...gameState.settings,
newGameInvitation: 'new_game',
invitationTimestamp: new Date().toISOString()
}
})
.eq('id', currentGameId);

console.log('Invitation sent to previous players');

// Wait a moment for invitation to propagate
await new Promise(resolve => setTimeout(resolve, 500));

// Clear the invitation flag
delete gameState.settings.newGameInvitation;
delete gameState.settings.invitationTimestamp;
gameState.isNewGameAfterPrevious = false;
} catch (err) {
console.error('Error sending invitation:', err);
}
}

// Switch to waiting room
gameState.stage = 'waiting';
document.getElementById('setup-phase').classList.add('hidden');
document.getElementById('waiting-room').classList.remove('hidden');

// Generate QR code for joining
generateQRCode();

// Update join section to show correct view (now isHost() will return true)
updateJoinSection();

// Create game in database - WAIT for it to complete so currentGameId is set
await createGameInDB();
console.log('Database ready - currentGameId:', currentGameId);
}

function showInstructions() {
document.getElementById('additional-rules-display').textContent =
gameState.settings.additionalRules || 'No additional rules specified.';
document.getElementById('instructions-modal').classList.remove('hidden');
}

function closeInstructions() {
document.getElementById('instructions-modal').classList.add('hidden');
}

function editSettings() {
if (!isHost()) {
alert('Only the host can edit settings!');
return;
}

if (confirm('Are you sure you want to edit settings? This will return you to the setup screen.')) {
document.getElementById('waiting-room').classList.add('hidden');
document.getElementById('setup-phase').classList.remove('hidden');
}
}

async function joinGame() {
const nameInput = document.getElementById('player-name-input');
const name = nameInput.value.trim();

if (!name) {
alert('Please enter your name!');
return;
}

if (gameState.players.length >= gameState.settings.maxPlayers) {
document.getElementById('room-full-message').classList.remove('hidden');
return;
}

// Check if player already exists (reconnection case)
const existingPlayer = gameState.players.find(p => p.name.toLowerCase() === name.toLowerCase());
if (existingPlayer) {
// Reconnect as this player
myPlayerName = existingPlayer.name;
nameInput.value = '';
updateJoinSection();
console.log('Reconnected as existing player:', name);

// Update last_seen in database
if (supabaseClient && currentGameId) {
await updatePlayerInDB(existingPlayer.name, { last_seen: new Date().toISOString() });
}

// Start polling to detect if we get kicked
startPlayerExistenceCheck();
return;
}

gameState.players.push({
name: name,
ready: true,
role: null,
tasks: [],
alive: true,
tasksCompleted: 0
});

// Track this device's player
myPlayerName = name;
console.log('Player joined:', name, '| isGameCreator:', isGameCreator, '| currentGameId:', currentGameId, '| current hostName:', gameState.hostName);

// If this device created the game and there's no host yet, set this player as host
// Defensive check: only set as host if hostName is null or undefined
if (isGameCreator && (gameState.hostName === null || gameState.hostName === undefined)) {
gameState.hostName = name;
console.log('Setting host:', name);

// Update host in database
if (supabaseClient && currentGameId) {
const { error } = await supabaseClient
.from('games')
.update({ host_name: name })
.eq('id', currentGameId);

if (error) {
console.error('Failed to set host in database:', error);
} else {
console.log('Host successfully set in database');
}
} else {
console.warn('Cannot set host in database - supabaseClient or currentGameId missing');
}
} else {
console.log('Not setting as host - isGameCreator:', isGameCreator, 'gameState.hostName:', gameState.hostName);
}

nameInput.value = '';
updateJoinSection();
updateLobby();

// Add player to database
await addPlayerToDB(name);

// Start polling to detect if we get kicked
startPlayerExistenceCheck();
}

function updateJoinSection() {
if (myPlayerName) {
// Hide join form, show already joined view
document.getElementById('join-form').classList.add('hidden');
document.getElementById('already-joined').classList.remove('hidden');
document.getElementById('my-player-name').textContent = myPlayerName;
} else {
// Show join form, hide already joined view
document.getElementById('join-form').classList.remove('hidden');
document.getElementById('already-joined').classList.add('hidden');
}

// Update host controls visibility
updateHostControls();
}

function updateLobby() {
// Safety check - only skip if we're not in waiting stage (prevents errors during menu transition)
if (gameState.stage !== 'waiting') {
console.log('updateLobby called but not in waiting stage, ignoring');
return;
}

// Additional safety check - ensure settings exist
if (!gameState.settings || !gameState.settings.minPlayers) {
console.log('updateLobby called but settings not initialized, ignoring');
return;
}

const lobbyDiv = document.getElementById('lobby-players');
if (!lobbyDiv) {
console.log('lobby-players element not found');
return;
}

lobbyDiv.innerHTML = '';

const readyPlayers = gameState.players.filter(p => p.ready);

gameState.players.forEach((player, index) => {
const badge = document.createElement('div');
badge.className = `player-badge ${player.ready ? 'player-ready' : ''}`;

const isPlayerHost = player.name === gameState.hostName;
const showKickButton = isHost() && player.name !== myPlayerName;

badge.innerHTML = `
<span>${player.name} ${isPlayerHost ? '👑' : ''}</span>
<div>
${player.ready ? '<span class="ready-indicator">Ready</span>' : ''}
${showKickButton ? `<button onclick="kickPlayer('${player.name}')" style="background: #ff3838; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px; font-size: 0.85rem;">Kick</button>` : ''}
</div>
`;
lobbyDiv.appendChild(badge);
});

document.getElementById('ready-count').textContent = readyPlayers.length;
document.getElementById('ready-list-count').textContent = readyPlayers.length;
document.getElementById('joined-count').textContent = gameState.players.length;

// Update start button - must be host AND have enough players
const startBtn = document.getElementById('start-game-btn');
const enoughPlayers = readyPlayers.length >= gameState.settings.minPlayers;
const userIsHost = isHost();

if (!userIsHost) {
// Non-host: always disabled
startBtn.disabled = true;
startBtn.textContent = 'Only host can start the game';
} else if (!enoughPlayers) {
// Host but not enough players: disabled
startBtn.disabled = true;
startBtn.textContent = `Start Game (Waiting for minimum players to be ready)`;
} else {
// Host with enough players: enabled
startBtn.disabled = false;
startBtn.textContent = 'Start Game';
}

// Update other host controls
updateHostControls();
}

function updateHostControls() {
// Show/hide Edit Settings button based on host status
const editSettingsBtn = document.getElementById('edit-settings-btn');

if (editSettingsBtn) {
if (isHost()) {
editSettingsBtn.style.display = '';
} else {
editSettingsBtn.style.display = 'none';
}
}

// Note: Start button is handled in updateLobby() to coordinate with player count
}

async function kickPlayer(playerName) {
if (!isHost()) {
alert('Only the host can kick players!');
return;
}

if (confirm(`Are you sure you want to kick ${playerName}?`)) {
console.log('Host kicking player:', playerName);

// Remove from local state
const playerIndex = gameState.players.findIndex(p => p.name === playerName);
if (playerIndex !== -1) {
gameState.players.splice(playerIndex, 1);
console.log('Removed from local state');
}

// Remove from database
console.log('Calling removePlayerFromDB...');
await removePlayerFromDB(playerName);
console.log('removePlayerFromDB completed');

updateLobby();
}
}

function editMyName() {
if (!myPlayerName) return;

const playerIndex = gameState.players.findIndex(p => p.name === myPlayerName);
if (playerIndex === -1) return;

const player = gameState.players[playerIndex];
const newName = prompt('Enter new name:', player.name);

if (newName === null || newName.trim() === '') {
return; // User cancelled or entered empty name
}

const trimmedName = newName.trim();

// Check if new name is different from current name
if (trimmedName.toLowerCase() === player.name.toLowerCase()) {
return; // No change needed
}

// Case-insensitive duplicate check (excluding current player)
if (gameState.players.some((p, i) => i !== playerIndex && p.name.toLowerCase() === trimmedName.toLowerCase())) {
alert('This name is already taken!');
return;
}

// Update the player's name
const oldName = player.name;
player.name = trimmedName;
myPlayerName = trimmedName;
updateJoinSection();
updateLobby();

// Update in database - need to delete old and insert new (since name is part of unique constraint)
if (supabaseClient && currentGameId) {
removePlayerFromDB(oldName).then(() => {
addPlayerToDB(trimmedName);
});
}
}

function leaveGame() {
if (!myPlayerName) return;

if (confirm('Are you sure you want to leave the game?')) {
const playerIndex = gameState.players.findIndex(p => p.name === myPlayerName);
const playerName = myPlayerName;
if (playerIndex !== -1) {
gameState.players.splice(playerIndex, 1);
}
myPlayerName = null;
updateJoinSection();
updateLobby();

// Remove from database
removePlayerFromDB(playerName);
}
}

function startGame() {
// Only host can start the game
if (!isHost()) {
alert('Only the host can start the game!');
return;
}

// Assign roles
const shuffled = [...gameState.players].sort(() => Math.random() - 0.5);
const imposterNames = shuffled.slice(0, gameState.settings.imposterCount).map(p => p.name);

// Collect all enabled tasks from selected rooms
const allTasks = [];
const uniqueTasks = [];

Object.keys(gameState.settings.selectedRooms).forEach(roomName => {
const room = gameState.settings.selectedRooms[roomName];
if (room.enabled) {
room.tasks.forEach(task => {
if (task.enabled) {
const taskObj = { room: roomName, task: task.name };
if (task.unique) {
uniqueTasks.push(taskObj);
} else {
allTasks.push(taskObj);
}
}
});
}
});

// Assign tasks to players
gameState.players.forEach(player => {
player.role = imposterNames.includes(player.name) ? 'imposter' : 'crewmate';
player.alive = true;
player.tasksCompleted = 0;

// Assign tasks based on role
const assignedTasks = [];
const isImposter = player.role === 'imposter';

// For imposters: only non-unique tasks (dummy tasks for appearance)
// For crewmates: mix of unique and non-unique tasks
const availableNonUnique = [...allTasks];
const availableUnique = isImposter ? [] : [...uniqueTasks];

// Shuffle available tasks
availableNonUnique.sort(() => Math.random() - 0.5);
availableUnique.sort(() => Math.random() - 0.5);

// Assign the required number of tasks
for (let i = 0; i < gameState.settings.tasksPerPlayer; i++) {
// Try to assign unique task first (crewmates only)
if (availableUnique.length > 0 && Math.random() < 0.3) {
const uniqueTask = availableUnique.shift();
assignedTasks.push(uniqueTask);
} else if (availableNonUnique.length > 0) {
// Assign regular task (can be reused across players)
const taskIndex = Math.floor(Math.random() * availableNonUnique.length);
assignedTasks.push(availableNonUnique[taskIndex]);
}
}

player.tasks = assignedTasks;
});

// Set current player based on this device's player (if joined)
if (myPlayerName) {
gameState.currentPlayer = myPlayerName;
} else {
// Default to first player if not joined (for host view)
gameState.currentPlayer = gameState.players[0]?.name || null;
}

// Switch to game phase
gameState.stage = 'playing';
document.getElementById('waiting-room').classList.add('hidden');
document.getElementById('game-phase').classList.remove('hidden');

displayGameplay();

// Update game state in database
updateGameInDB();

// Update all players with their roles/tasks in database
if (supabaseClient && currentGameId) {
gameState.players.forEach(player => {
updatePlayerInDB(player.name, {
role: player.role,
tasks: player.tasks,
alive: player.alive,
tasks_completed: player.tasksCompleted
});
});
}
}

function displayGameplay() {
const player = gameState.players.find(p => p.name === gameState.currentPlayer);
if (!player) return;

// Display actual role but with same color styling for both (prevents visual giveaways)
const roleText = player.role.charAt(0).toUpperCase() + player.role.slice(1);
document.getElementById('role-text').textContent = roleText;
// Both roles use the same color class to avoid visual giveaways
document.getElementById('role-text').className = 'role-revealed role-crewmate';

document.getElementById('meetings-remaining').textContent =
gameState.settings.meetingLimit - gameState.meetingsUsed;

// Render player's task list
renderPlayerTasks();
}

function renderPlayerTasks() {
const player = gameState.players.find(p => p.name === gameState.currentPlayer);
if (!player) return;

const tasksContainer = document.getElementById('player-tasks');
const completedCount = document.getElementById('completed-tasks-count');
const totalCount = document.getElementById('total-tasks-count');

tasksContainer.innerHTML = '';
completedCount.textContent = player.tasksCompleted || 0;
totalCount.textContent = player.tasks.length;

// Display each task with a checkbox
player.tasks.forEach((taskObj, index) => {
const taskItem = document.createElement('div');
taskItem.style.cssText = 'display: flex; align-items: center; padding: 8px; margin-bottom: 5px; background: rgba(255,255,255,0.05); border-radius: 5px;';

const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.id = `task-${index}`;
checkbox.style.cssText = 'margin-right: 10px; width: 18px; height: 18px; cursor: pointer;';
checkbox.checked = index < (player.tasksCompleted || 0);

// Only allow crewmates to actually complete tasks (imposters' checks are cosmetic)
checkbox.onchange = () => toggleTaskComplete(index);

const label = document.createElement('label');
label.htmlFor = `task-${index}`;
label.style.cssText = 'flex: 1; cursor: pointer; color: #fff;';
label.textContent = `${taskObj.task} (${taskObj.room})`;

taskItem.appendChild(checkbox);
taskItem.appendChild(label);
tasksContainer.appendChild(taskItem);
});
}

function toggleTaskComplete(taskIndex) {
const player = gameState.players.find(p => p.name === gameState.currentPlayer);
if (!player) return;

const checkbox = document.getElementById(`task-${taskIndex}`);

if (checkbox.checked) {
// Task completed
player.tasksCompleted = Math.min((player.tasksCompleted || 0) + 1, player.tasks.length);
} else {
// Task unchecked
player.tasksCompleted = Math.max((player.tasksCompleted || 0) - 1, 0);
}

// Update the count display
document.getElementById('completed-tasks-count').textContent = player.tasksCompleted;

// Only update database for crewmates (imposters' tasks are dummy)
if (player.role === 'crewmate') {
// Update player in database
if (supabaseClient && currentGameId) {
updatePlayerInDB(player.name, {
tasks_completed: player.tasksCompleted
});
}

// Check if crewmates won
checkCrewmateVictory();
}
}

function checkCrewmateVictory() {
// Count total tasks and completed tasks for all crewmates
let totalCrewmateTasks = 0;
let completedCrewmateTasks = 0;

gameState.players.forEach(player => {
if (player.role === 'crewmate' && player.alive) {
totalCrewmateTasks += player.tasks.length;
completedCrewmateTasks += player.tasksCompleted || 0;
}
});

// Check if all tasks are completed
if (totalCrewmateTasks > 0 && completedCrewmateTasks >= totalCrewmateTasks) {
endGame('crewmates', 'All tasks completed!');
}
}

function toggleRole() {
const hidden = document.getElementById('role-hidden');
const revealed = document.getElementById('role-revealed');
const btn = document.getElementById('toggle-role-btn');

if (hidden.classList.contains('hidden')) {
hidden.classList.remove('hidden');
revealed.classList.add('hidden');
btn.textContent = 'Reveal Role';
} else {
hidden.classList.add('hidden');
revealed.classList.remove('hidden');
btn.textContent = 'Hide Role';
}
}

function eliminatePlayer() {
const player = gameState.players.find(p => p.name === gameState.currentPlayer);
if (player) {
player.alive = false;

// Generate QR code for eliminated player
const eliminatedMessage = `ELIMINATED: ${player.name} - Room: ${gameState.roomCode}`;
const qrCodeImage = document.getElementById('eliminated-qr-code');
const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(eliminatedMessage)}`;
qrCodeImage.src = qrApiUrl;

// Show eliminated modal
document.getElementById('eliminated-modal').classList.remove('hidden');
}
}

async function callMeeting() {
if (gameState.meetingsUsed >= gameState.settings.meetingLimit) {
alert('No emergency meetings remaining!');
return;
}

// Set this player as the meeting caller
gameState.meetingCaller = myPlayerName;
console.log('Meeting called by:', myPlayerName);

// Update database to trigger meeting for all players
if (supabaseClient && currentGameId) {
try {
const { error } = await supabaseClient
.from('games')
.update({
stage: 'meeting',
meetings_used: gameState.meetingsUsed,
updated_at: new Date().toISOString()
})
.eq('id', currentGameId);

if (error) {
console.error('Error updating meeting state:', error);
} else {
console.log('Meeting state updated in database');
}
} catch (err) {
console.error('Error calling meeting:', err);
}
}

// Show the alert for this player
document.getElementById('meeting-location-alert').textContent = gameState.settings.meetingRoom;
document.getElementById('meeting-overlay').classList.remove('hidden');

// Play alarm sound
playAlarmSound();
}

function playAlarmSound() {
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let count = 0;
const interval = setInterval(() => {
if (count >= 5) {
clearInterval(interval);
return;
}
const oscillator = audioContext.createOscillator();
const gainNode = audioContext.createGain();
oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);
oscillator.frequency.value = 800;
oscillator.type = 'square';
gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
oscillator.start(audioContext.currentTime);
oscillator.stop(audioContext.currentTime + 0.3);
count++;
}, 400);
}

function acknowledgeMeeting() {
document.getElementById('meeting-overlay').classList.add('hidden');
document.getElementById('game-phase').classList.add('hidden');
document.getElementById('meeting-phase').classList.remove('hidden');

// Hide all meeting sub-phases except discussion
document.getElementById('report-selection').classList.add('hidden');
document.getElementById('voting-phase').classList.add('hidden');
document.getElementById('vote-results').classList.add('hidden');
document.getElementById('discussion-phase').classList.remove('hidden');

// Update discussion header based on meeting type
const discussionHeader = document.querySelector('#discussion-phase h2');
if (gameState.meetingType === 'report') {
discussionHeader.textContent = 'Body Reported - Discussion';
} else {
discussionHeader.textContent = 'Emergency Meeting - Discussion';
}

// If emergency meeting, decrement the counter
if (gameState.meetingType === 'emergency') {
gameState.meetingsUsed++;

// Update meetings used in database
if (supabaseClient && currentGameId) {
updateGameInDB();
}
}

// Initialize meeting ready tracking
if (!gameState.meetingReady) {
gameState.meetingReady = {};
}

// Mark this player as ready
if (myPlayerName) {
gameState.meetingReady[myPlayerName] = true;
}

// Show toggle button for host controls if this is the host
if (isHost()) {
document.getElementById('toggle-elimination-controls-btn').classList.remove('hidden');
renderHostPlayerStatus();
}

// Update ready count display
updateReadyStatus();

// Sync to database
if (supabaseClient && currentGameId) {
updateGameInDB();
}
}


function renderHostPlayerStatus() {
const list = document.getElementById('host-player-status-list');
list.innerHTML = '';

// Sort players alphabetically by name for easier lookup
const sortedPlayers = [...gameState.players].sort((a, b) =>
a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
);

sortedPlayers.forEach(player => {
const item = document.createElement('div');
item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 6px;';

const statusBadge = player.alive
? '<span style="color: #4caf50;">✓ Alive</span>'
: '<span style="color: #ff3838;">✗ Eliminated</span>';

item.innerHTML = `
<span>${player.name} ${statusBadge}</span>
<button onclick="confirmTogglePlayerAlive('${player.name}')" class="btn-${player.alive ? 'danger' : 'success'} btn-small">
${player.alive ? 'Mark Eliminated' : 'Mark Alive'}
</button>
`;
list.appendChild(item);
});
}

function toggleEliminationControls() {
const controlsSection = document.getElementById('host-elimination-controls');
const toggleButton = document.getElementById('toggle-elimination-controls-btn');

if (controlsSection.classList.contains('hidden')) {
// Show the controls section
controlsSection.classList.remove('hidden');
toggleButton.classList.add('hidden');
} else {
// Hide the controls section
controlsSection.classList.add('hidden');
toggleButton.classList.remove('hidden');
}
}

function confirmTogglePlayerAlive(playerName) {
// No confirmation needed - the toggle button itself provides the extra step
togglePlayerAlive(playerName);
}

async function togglePlayerAlive(playerName) {
const player = gameState.players.find(p => p.name === playerName);
if (player) {
player.alive = !player.alive;
renderHostPlayerStatus();

// Sync to database
if (supabaseClient && currentGameId) {
await updatePlayerInDB(playerName, { alive: player.alive });
}

// Check win conditions after marking elimination
const gameResult = checkWinConditions();
if (gameResult) {
const confirmEnd = confirm(`${gameResult.reason}\n\nEnd the game now with ${gameResult.winner} as winners?`);
if (confirmEnd) {
await endGame(gameResult.winner);
} else {
// Undo the elimination
player.alive = !player.alive;
renderHostPlayerStatus();
if (supabaseClient && currentGameId) {
await updatePlayerInDB(playerName, { alive: player.alive });
}
}
}
}
}

function updateReadyStatus() {
const readyCount = Object.keys(gameState.meetingReady || {}).length;
const totalCount = gameState.players.length;

document.getElementById('ready-for-vote-count').textContent = readyCount;
document.getElementById('total-players-count').textContent = totalCount;

// Update ready players list
const readyList = document.getElementById('players-ready-list');
const readyPlayers = Object.keys(gameState.meetingReady || {});
readyList.textContent = readyPlayers.length > 0
? readyPlayers.join(', ')
: 'None yet';

// Show start voting button to host if everyone is ready
if (isHost() && readyCount === totalCount && totalCount > 0) {
document.getElementById('host-start-voting-btn').classList.remove('hidden');
document.getElementById('waiting-for-players-msg').classList.add('hidden');
} else {
document.getElementById('host-start-voting-btn').classList.add('hidden');
document.getElementById('waiting-for-players-msg').classList.remove('hidden');
}
}

function hostStartVoting() {
// Host initiates voting - update game state
gameState.votingStarted = true;
gameState.votes = {};

// Sync to database to notify all players
if (supabaseClient && currentGameId) {
updateGameInDB();
}

// Start voting for host
startVoting();
}

function startDiscussionTimer() {
let timeLeft = gameState.settings.meetingTimer;
document.getElementById('discussion-timer').textContent = timeLeft;

const interval = setInterval(() => {
timeLeft--;
document.getElementById('discussion-timer').textContent = timeLeft;

if (timeLeft <= 0) {
clearInterval(interval);
startVoting();
}
}, 1000);
}

function startVoting() {
document.getElementById('discussion-phase').classList.add('hidden');
document.getElementById('voting-phase').classList.remove('hidden');

// Reset vote selection
selectedVote = null;
document.getElementById('submit-vote-btn').disabled = true;

// Show player status list
const statusList = document.getElementById('vote-player-status-list');
statusList.innerHTML = '';
gameState.players.forEach(player => {
const item = document.createElement('div');
item.style.cssText = 'padding: 6px; margin-bottom: 4px;';
const statusBadge = player.alive
? '<span style="color: #4caf50;">✓ Alive</span>'
: '<span style="color: #ff3838;">✗ Eliminated</span>';
item.innerHTML = `${player.name}: ${statusBadge}`;
statusList.appendChild(item);
});

// Populate vote options (only living players)
const voteOptions = document.getElementById('vote-options');
voteOptions.innerHTML = '';

gameState.players.filter(p => p.alive).forEach(player => {
const option = document.createElement('div');
option.className = 'vote-option';
option.onclick = () => selectVote(player.name, option);
option.innerHTML = `<strong>${player.name}</strong>`;
voteOptions.appendChild(option);
});

// Add skip option
const skipOption = document.createElement('div');
skipOption.className = 'vote-option';
skipOption.onclick = () => selectVote('skip', skipOption);
skipOption.innerHTML = '<strong>Skip</strong>';
voteOptions.appendChild(skipOption);

// Start vote timer
let timeLeft = gameState.settings.meetingTimer;
document.getElementById('vote-timer').textContent = timeLeft;

const interval = setInterval(() => {
timeLeft--;
document.getElementById('vote-timer').textContent = timeLeft;

if (timeLeft <= 0) {
clearInterval(interval);
// Auto-skip if no vote selected
if (!selectedVote) {
selectedVote = 'skip';
}
// Disable button to prevent double-submit
document.getElementById('submit-vote-btn').disabled = true;
submitVote();
}
}, 1000);
}

let selectedVote = null;
function selectVote(playerName, element) {
document.querySelectorAll('.vote-option').forEach(opt => opt.classList.remove('selected'));
element.classList.add('selected');
selectedVote = playerName;
const submitBtn = document.getElementById('submit-vote-btn');
if (submitBtn) {
submitBtn.disabled = false;
}
}

async function submitVote() {
// Disable submit button to prevent double-voting
document.getElementById('submit-vote-btn').disabled = true;

// Record this player's vote
if (!gameState.votes) {
gameState.votes = {};
}

gameState.votes[myPlayerName] = selectedVote || 'skip';

// Sync vote to database
if (supabaseClient && currentGameId) {
await updateGameInDB();
}

// Show waiting screen for this player
document.getElementById('voting-phase').classList.add('hidden');
document.getElementById('vote-results').classList.remove('hidden');

const totalPlayers = gameState.players.length;
const votesSubmitted = Object.keys(gameState.votes).length;

document.getElementById('results-display').innerHTML = `
<p style="color: #a0a0a0;">Votes submitted: ${votesSubmitted}/${totalPlayers}</p>
<p style="color: #5eb3f6;">Waiting for all players to vote...</p>
`;

// Only host tallies votes, and only when ALL players have voted
if (!isHost()) {
return;
}

// Check if all players have voted
if (votesSubmitted < totalPlayers) {
// Not all votes in yet, wait
return;
}

// All votes are in! Tally them
await tallyVotes();
}

async function tallyVotes() {
// Prevent double tallying
if (gameState.votesTallied) {
return;
}
gameState.votesTallied = true;

const voteCounts = {};
Object.values(gameState.votes).forEach(vote => {
voteCounts[vote] = (voteCounts[vote] || 0) + 1;
});

// Find player with most votes (excluding 'skip')
let eliminatedPlayer = null;
let maxVotes = 0;
const playersWithMaxVotes = [];

// Find the maximum vote count (excluding skip)
Object.entries(voteCounts).forEach(([playerName, count]) => {
if (playerName !== 'skip' && count > maxVotes) {
maxVotes = count;
}
});

// Find all players with the maximum vote count
if (maxVotes > 0) {
Object.entries(voteCounts).forEach(([playerName, count]) => {
if (playerName !== 'skip' && count === maxVotes) {
playersWithMaxVotes.push(playerName);
}
});
}

// Only eliminate if exactly one player has the most votes
const isTie = playersWithMaxVotes.length > 1;
if (!isTie && playersWithMaxVotes.length === 1) {
eliminatedPlayer = playersWithMaxVotes[0];
}

// Eliminate player if votes are conclusive
if (eliminatedPlayer) {
const player = gameState.players.find(p => p.name === eliminatedPlayer);
if (player) {
player.alive = false;

// Update database
if (supabaseClient && currentGameId) {
await updatePlayerInDB(eliminatedPlayer, { alive: false });
}
}
}

// Display results
displayVoteResults(voteCounts, eliminatedPlayer, isTie);

// Sync game state to show results to all players
if (supabaseClient && currentGameId) {
await updateGameInDB();
}

// Check win conditions ONLY if someone was actually eliminated
if (eliminatedPlayer) {
const gameResult = checkWinConditions();
if (gameResult) {
// Game over - show message and end game
setTimeout(() => {
endGame(gameResult.winner);
}, 3000);
return; // Don't show resume button, game is ending
}
}

// Show resume button for host (game continues)
const resumeBtn = document.getElementById('resume-game-btn');
const waitingMsg = document.getElementById('waiting-for-host-resume');
if (isHost()) {
resumeBtn.classList.remove('hidden');
waitingMsg.classList.add('hidden');
} else {
resumeBtn.classList.add('hidden');
waitingMsg.textContent = 'Waiting for host to resume the game...';
waitingMsg.classList.remove('hidden');
}
}

function displayVoteResults(voteCounts, eliminatedPlayer, isTie) {
document.getElementById('voting-phase').classList.add('hidden');
document.getElementById('vote-results').classList.remove('hidden');

const resultsDisplay = document.getElementById('results-display');
const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

resultsDisplay.innerHTML = '';
Object.entries(voteCounts).sort((a, b) => b[1] - a[1]).forEach(([playerName, count]) => {
const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
resultsDisplay.innerHTML += `
<div class="vote-results" style="margin-bottom: 15px;">
<div>${playerName === 'skip' ? 'Skipped' : playerName}: <strong>${count} vote${count !== 1 ? 's' : ''}</strong></div>
<div class="vote-bar"><div class="vote-bar-fill" style="width: ${percentage}%"></div></div>
</div>
`;
});

// Show elimination result
const ejectedText = document.getElementById('ejected-player-text');
if (isTie) {
ejectedText.textContent = 'It was a tie. No one was ejected.';
} else if (eliminatedPlayer) {
const player = gameState.players.find(p => p.name === eliminatedPlayer);
const role = player?.role || 'unknown';
ejectedText.textContent = `${eliminatedPlayer} was ejected. They were ${role === 'imposter' ? 'an Imposter' : 'a Crewmate'}.`;
} else {
ejectedText.textContent = 'No one was ejected.';
}

// Show appropriate message/button based on host status
const resumeBtn = document.getElementById('resume-game-btn');
const waitingMsg = document.getElementById('waiting-for-host-resume');

// Initially hide both (will be shown by tallyVotes when game doesn't end)
resumeBtn.classList.add('hidden');
waitingMsg.classList.add('hidden');

// For non-hosts, show waiting message immediately
if (!isHost()) {
waitingMsg.textContent = 'Waiting for host to resume the game...';
waitingMsg.classList.remove('hidden');
}
}

function checkWinConditions() {
// Ensure all players have alive property set (defensive)
gameState.players.forEach(p => {
if (p.alive === undefined || p.alive === null) {
console.warn(`Player ${p.name} has undefined alive status, defaulting to true`);
p.alive = true;
}
});

const alivePlayers = gameState.players.filter(p => p.alive === true);
const aliveImposters = alivePlayers.filter(p => p.role === 'imposter').length;
const aliveCrewmates = alivePlayers.filter(p => p.role === 'crewmate').length;
const totalImposters = gameState.players.filter(p => p.role === 'imposter').length;
const totalCrewmates = gameState.players.filter(p => p.role === 'crewmate').length;

console.log('=== Win Condition Check ===');
console.log(`Alive imposters: ${aliveImposters}/${totalImposters}`);
console.log(`Alive crewmates: ${aliveCrewmates}/${totalCrewmates}`);
console.log(`All players:`, gameState.players.map(p => ({ name: p.name, role: p.role, alive: p.alive })));

// Crewmates win if all imposters are eliminated (and there were imposters to begin with)
if (aliveImposters === 0 && totalImposters > 0) {
console.log('WIN CONDITION: Crewmates win - all imposters eliminated');
return { winner: 'crewmates', reason: 'All imposters eliminated' };
}

// Imposters win if they equal or outnumber crewmates (and there are crewmates to outnumber)
if (aliveImposters >= aliveCrewmates && aliveCrewmates > 0 && aliveImposters > 0) {
console.log('WIN CONDITION: Imposters win - equal or outnumber crewmates');
return { winner: 'imposters', reason: 'Imposters equal or outnumber crewmates' };
}

console.log('WIN CONDITION: None met, game continues');
return null;
}

function resumeGame() {
// Only host can resume the game
if (!isHost()) {
alert('Only the host can resume the game!');
return;
}

document.getElementById('meeting-phase').classList.add('hidden');
document.getElementById('game-phase').classList.remove('hidden');
gameState.stage = 'playing';

// Reset meeting state
gameState.meetingReady = {};
gameState.votes = {};
gameState.votingStarted = false;
gameState.votesTallied = false;
gameState.meetingType = null;
gameState.meetingCaller = null;
selectedVote = null;

// Update database
if (supabaseClient && currentGameId) {
updateGameInDB();
}

// Show current view
displayGameplay();
}

function closeEliminatedModal() {
document.getElementById('eliminated-modal').classList.add('hidden');
}

function endGame(winner, message) {
console.log('Game ending - Winner:', winner, 'Message:', message);

// Update game state
gameState.gameEnded = true;
gameState.winner = winner;
gameState.stage = 'ended';

// Update database
if (supabaseClient && currentGameId) {
updateGameInDB();
}

// Hide game phase
document.getElementById('game-phase').classList.add('hidden');
document.getElementById('meeting-phase').classList.add('hidden');

// Show game end screen
document.getElementById('game-end').classList.remove('hidden');

// Determine if this player won or lost
const player = gameState.players.find(p => p.name === myPlayerName);
const playerRole = player ? player.role : null;

// Crewmates win if winner is 'crewmates', imposters win if winner is 'imposters'
const didPlayerWin = (playerRole === 'crewmate' && winner === 'crewmates') ||
(playerRole === 'imposter' && winner === 'imposters');

// Show appropriate screen
if (didPlayerWin) {
document.getElementById('victory-screen').classList.remove('hidden');
document.getElementById('defeat-screen').classList.add('hidden');
document.getElementById('meeting-location-victory').textContent = gameState.settings.meetingRoom;
} else {
document.getElementById('victory-screen').classList.add('hidden');
document.getElementById('defeat-screen').classList.remove('hidden');
document.getElementById('meeting-location-defeat').textContent = gameState.settings.meetingRoom;
}

// Populate game summary
populateGameSummary();

// Show host controls if this player is the host
if (isHost()) {
document.getElementById('host-game-controls').classList.remove('hidden');
}
}

function populateGameSummary() {
const summaryDiv = document.getElementById('game-summary');
const winningTeam = document.getElementById('winning-team');

// Set winning team text
if (gameState.winner === 'crewmates') {
winningTeam.textContent = 'Crewmates Win!';
winningTeam.style.color = '#4CAF50';
} else if (gameState.winner === 'imposters') {
winningTeam.textContent = 'Imposters Win!';
winningTeam.style.color = '#ff3838';
}

// Build player summary HTML
summaryDiv.innerHTML = '';
gameState.players.forEach(player => {
const playerCard = document.createElement('div');
playerCard.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid ' + (player.role === 'imposter' ? '#ff3838' : '#4CAF50');

const roleText = player.role.charAt(0).toUpperCase() + player.role.slice(1);
const statusText = player.alive ? 'Alive' : 'Eliminated';
const statusColor = player.alive ? '#4CAF50' : '#ff3838';

// Build tasks list
let tasksHTML = '<div style="margin-top: 10px;">';
if (player.tasks && player.tasks.length > 0) {
player.tasks.forEach((taskObj, index) => {
const completed = index < (player.tasksCompleted || 0);
const checkmark = completed ? '✓' : '○';
const color = completed ? '#4CAF50' : '#a0a0a0';
tasksHTML += `<div style="color: ${color}; font-size: 0.9rem; margin: 3px 0;">${checkmark} ${taskObj.task} (${taskObj.room})</div>`;
});
} else {
tasksHTML += '<div style="color: #a0a0a0; font-size: 0.9rem;">No tasks</div>';
}
tasksHTML += '</div>';

playerCard.innerHTML = `
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
<strong style="font-size: 1.1rem;">${player.name}</strong>
<div style="text-align: right;">
<span style="background: ${player.role === 'imposter' ? '#ff3838' : '#4CAF50'}; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem; margin-right: 8px;">${roleText}</span>
<span style="color: ${statusColor}; font-size: 0.9rem;">${statusText}</span>
</div>
</div>
<div style="color: #a0a0a0; font-size: 0.9rem; margin-bottom: 5px;">
Tasks: ${player.tasksCompleted || 0}/${player.tasks ? player.tasks.length : 0} completed
</div>
${tasksHTML}
`;

summaryDiv.appendChild(playerCard);
});
}

function closeVictoryScreen() {
document.getElementById('victory-screen').classList.add('hidden');
}

function closeDefeatScreen() {
document.getElementById('defeat-screen').classList.add('hidden');
}

async function newGameSameSettings() {
if (!isHost()) return;

console.log('Host starting new game with same settings - going to setup');

// Reset game state but keep settings
gameState.players = [];
gameState.meetingsUsed = 0;
gameState.gameEnded = false;
gameState.stage = 'setup';  // Go to setup, not waiting
gameState.winner = null;
gameState.meetingCaller = null;
gameState.meetingType = null;
gameState.isNewGameAfterPrevious = true;  // Flag to send invitations later

// Update database
if (supabaseClient && currentGameId) {
await updateGameInDB();
}

// Clear all game end UI
document.getElementById('victory-screen').classList.add('hidden');
document.getElementById('defeat-screen').classList.add('hidden');
document.getElementById('game-summary').innerHTML = '';
document.getElementById('winning-team').textContent = '';
document.getElementById('host-game-controls').classList.add('hidden');

// Hide game end, show setup
document.getElementById('game-end').classList.add('hidden');
document.getElementById('setup-phase').classList.remove('hidden');
}

async function newGameNewSettings() {
if (!isHost()) return;

console.log('Host starting new game with new settings - going to setup');

// Reset game state
gameState.players = [];
gameState.meetingsUsed = 0;
gameState.gameEnded = false;
gameState.stage = 'setup';
gameState.winner = null;
gameState.meetingCaller = null;
gameState.meetingType = null;
gameState.isNewGameAfterPrevious = true;  // Flag to send invitations later

// Update database
if (supabaseClient && currentGameId) {
await updateGameInDB();
}

// Clear all game end UI
document.getElementById('victory-screen').classList.add('hidden');
document.getElementById('defeat-screen').classList.add('hidden');
document.getElementById('game-summary').innerHTML = '';
document.getElementById('winning-team').textContent = '';
document.getElementById('host-game-controls').classList.add('hidden');

// Hide game end, show setup
document.getElementById('game-end').classList.add('hidden');
document.getElementById('setup-phase').classList.remove('hidden');
}

function acceptNewGameInvitation() {
console.log('=== acceptNewGameInvitation called ===');
console.log('myPlayerName:', myPlayerName);

// Hide the invitation modal and join button
document.getElementById('new-game-invitation').classList.add('hidden');
document.getElementById('join-next-game-section').classList.add('hidden');
console.log('Invitation modal hidden');

// Clear all game end UI
document.getElementById('victory-screen').classList.add('hidden');
document.getElementById('defeat-screen').classList.add('hidden');
document.getElementById('game-summary').innerHTML = '';
document.getElementById('winning-team').textContent = '';
document.getElementById('game-end').classList.add('hidden');
console.log('Game end UI cleared');

// Show name confirmation modal
console.log('Calling showNameConfirmation...');
showNameConfirmation();
}

function showNameConfirmation() {
console.log('=== showNameConfirmation called ===');
console.log('myPlayerName:', myPlayerName);

// Set the previous name display
document.getElementById('previous-name-display').textContent = myPlayerName || '';
console.log('Set previous name display');

// Reset the edit section
document.getElementById('name-edit-section').classList.add('hidden');
document.getElementById('name-edit-input').value = myPlayerName || '';
document.getElementById('confirm-name-btn').classList.remove('hidden');
document.getElementById('edit-name-btn').classList.remove('hidden');
console.log('Reset edit section and buttons');

// Show the modal
document.getElementById('name-confirmation-modal').classList.remove('hidden');
console.log('Name confirmation modal shown');
}

function editPlayerName() {
console.log('Player wants to edit name');

// Show the edit input section
document.getElementById('name-edit-section').classList.remove('hidden');
document.getElementById('name-edit-input').focus();

// Hide the confirm and edit buttons, only show the input
document.getElementById('confirm-name-btn').textContent = 'Save Name';
document.getElementById('edit-name-btn').classList.add('hidden');
}

async function confirmPlayerName() {
console.log('=== confirmPlayerName called ===');

// Check if we're in edit mode
const editSection = document.getElementById('name-edit-section');
let nameToUse = myPlayerName;

console.log('Edit mode:', !editSection.classList.contains('hidden'));

if (!editSection.classList.contains('hidden')) {
// In edit mode - get the new name
const newName = document.getElementById('name-edit-input').value.trim();
if (!newName) {
alert('Please enter a name');
return;
}
nameToUse = newName;
myPlayerName = newName; // Update the stored name
console.log('Name changed to:', nameToUse);
}

console.log('Player confirmed name:', nameToUse);

// Hide the modal
document.getElementById('name-confirmation-modal').classList.add('hidden');
console.log('Name confirmation modal hidden');

// Show waiting room
document.getElementById('waiting-room').classList.remove('hidden');
console.log('Waiting room shown');

// Add player to the game
if (supabaseClient && currentGameId) {
console.log('Adding player to game...');
await addPlayerToGame(nameToUse);
console.log('Player added');
}
}

function leaveGame() {
console.log('Player chose to leave game');

// Hide the modal
document.getElementById('name-confirmation-modal').classList.add('hidden');

// Return to menu
returnToMenu();
}

function declineNewGameInvitation(response) {
console.log('Player declined new game invitation:', response);

// Hide the invitation modal
document.getElementById('new-game-invitation').classList.add('hidden');

if (response === 'later') {
// Show "Join Next Game" button
document.getElementById('join-next-game-section').classList.remove('hidden');
}
// If response is 'no', just stay in the current screen
}

function endSession() {
if (confirm('Are you sure you want to end this session?')) {
location.reload();
}
}

