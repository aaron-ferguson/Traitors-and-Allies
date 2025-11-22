// Import dependencies
import {
  gameState,
  supabaseClient,
  currentGameId,
  myPlayerName,
  isGameCreator,
  playerExistenceInterval,
  isHost,
  setMyPlayerName,
  setIsGameCreator,
  setCurrentGameId,
  setPlayerExistenceInterval
} from './game-state.js';
import {
  createGameInDB,
  joinGameFromDB,
  addPlayerToDB,
  updateGameInDB,
  updatePlayerInDB,
  removePlayerFromDB,
  subscribeToGame,
  subscribeToPlayers,
  startPlayerExistenceCheck,
  unsubscribeFromChannels
} from './supabase-backend.js';

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
document.getElementById('traitor-count-display').textContent = gameState.settings.traitorCount;

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
setPlayerExistenceInterval(null);
}

// Unsubscribe from channels FIRST to prevent callbacks from firing
unsubscribeFromChannels();

// Clear player state
setMyPlayerName(null);
setIsGameCreator(false);

// Clear game state
Object.assign(gameState, {
stage: 'setup',
roomCode: '',
hostName: null,
settings: {
minPlayers: 4,
maxPlayers: 10,
tasksPerPlayer: 3,
traitorCount: 1,
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
});

// Hide all phases, show menu
document.getElementById('setup-phase').classList.add('hidden');
document.getElementById('waiting-room').classList.add('hidden');
document.getElementById('game-phase').classList.add('hidden');
document.getElementById('meeting-phase').classList.add('hidden');
document.getElementById('game-end').classList.add('hidden');
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
const feedback = document.getElementById('copy-feedback');

// Try modern clipboard API first
navigator.clipboard.writeText(url)
.then(() => {
feedback.textContent = 'Link copied!';
feedback.style.opacity = '1';
setTimeout(() => feedback.style.opacity = '0', 2000);
})
.catch((err) => {
// Fallback for when document is not focused or clipboard API fails
console.warn('Clipboard API failed, using fallback method:', err);
try {
// Create a temporary textarea
const textarea = document.createElement('textarea');
textarea.value = url;
textarea.style.position = 'fixed';
textarea.style.opacity = '0';
document.body.appendChild(textarea);
textarea.select();
const success = document.execCommand('copy');
document.body.removeChild(textarea);

if (success) {
feedback.textContent = 'Link copied!';
feedback.style.opacity = '1';
setTimeout(() => feedback.style.opacity = '0', 2000);
} else {
throw new Error('execCommand failed');
}
} catch (fallbackErr) {
console.error('All copy methods failed:', fallbackErr);
feedback.textContent = 'Copy failed - please copy manually';
feedback.style.opacity = '1';
feedback.style.color = '#ff6b6b';
setTimeout(() => {
feedback.style.opacity = '0';
feedback.style.color = '#4CAF50';
}, 3000);
}
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
gameState.settings.traitorCount = parseInt(document.getElementById('traitor-count').value);
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

if (gameState.settings.traitorCount < 1) {
alert('There must be at least 1 traitor!');
return;
}

if (gameState.settings.traitorCount >= gameState.settings.maxPlayers) {
alert('Number of traitors must be less than maximum players!');
return;
}

if (!gameState.settings.meetingRoom) {
alert('Please select a meeting room!');
return;
}

// Mark this device as the game creator FIRST (before any UI updates that check host status)
setIsGameCreator(true);
console.log('Game created - isGameCreator set to true');

// Generate room code
gameState.roomCode = generateRoomCode();
document.getElementById('room-code').textContent = gameState.roomCode;

// Update displays
document.getElementById('min-players-display').textContent = gameState.settings.minPlayers;
document.getElementById('max-players-display').textContent = gameState.settings.maxPlayers;
document.getElementById('traitor-count-display').textContent = gameState.settings.traitorCount;

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

// Check if this came from newGameNewSettings() (has previous game ID saved)
const previousGameId = gameState.previousGameIdForInvites;
if (previousGameId && supabaseClient) {
console.log('Sending invitations to players from previous game:', previousGameId);

try {
const { data: previousGame } = await supabaseClient
.from('games')
.select('settings')
.eq('id', previousGameId)
.single();

if (previousGame) {
await supabaseClient
.from('games')
.update({
settings: {
...previousGame.settings,
newGameInvitation: 'new_game',
newGameRoomCode: gameState.roomCode,
invitationTimestamp: new Date().toISOString()
}
})
.eq('id', previousGameId);

console.log('Invitation sent to previous players with new room code:', gameState.roomCode);
}

// Clear the saved previous game ID
delete gameState.previousGameIdForInvites;
} catch (err) {
console.error('Error sending invitation:', err);
}
}
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
setMyPlayerName(existingPlayer.name);
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
ready: true, // Player is ready when they type their name and click "Join Game"
role: null,
tasks: [],
alive: true,
tasksCompleted: 0,
emergencyMeetingsUsed: 0
});

// Track this device's player
setMyPlayerName(name);
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

// Add player to database with ready=true (they confirmed by typing name and joining)
await addPlayerToDB(name, true);

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
console.log('=== UPDATE LOBBY CALLED ===');
console.log('gameState.stage:', gameState.stage);
console.log('gameState.players count:', gameState.players.length);
console.log('Players:', gameState.players.map(p => p.name).join(', '));

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
console.log('Ready players count:', readyPlayers.length);

// Sort players alphabetically by name
const sortedPlayers = [...gameState.players].sort((a, b) =>
  a.name.localeCompare(b.name)
);

sortedPlayers.forEach((player, index) => {
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
setMyPlayerName(trimmedName);

// Mark player as ready after they edit their name
player.ready = true;
console.log('Player edited name - marking as ready');

updateJoinSection();
updateLobby();

// Update in database - need to delete old and insert new (since name is part of unique constraint)
if (supabaseClient && currentGameId) {
removePlayerFromDB(oldName).then(async () => {
await addPlayerToDB(trimmedName, true); // Add with ready=true
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
setMyPlayerName(null);
updateJoinSection();
updateLobby();

// Remove from database
removePlayerFromDB(playerName);
}
}

async function markPlayerReady(playerName) {
const player = gameState.players.find(p => p.name === playerName);
if (!player) {
console.warn('Cannot mark player as ready - player not found:', playerName);
return;
}

// Update local state
player.ready = true;
console.log('Marked player as ready:', playerName);

// Update UI
updateLobby();

// Update database
if (supabaseClient && currentGameId) {
await updatePlayerInDB(playerName, { ready: true });
}
}

function startGame() {
console.log('=== START GAME CALLED ===');
console.log('isHost():', isHost());
console.log('currentGameId:', currentGameId);
console.log('supabaseClient:', !!supabaseClient);

// Only host can start the game
if (!isHost()) {
alert('Only the host can start the game!');
return;
}

// Validate traitor count
if (gameState.settings.traitorCount < 1) {
alert('Cannot start game: There must be at least 1 traitor!');
return;
}

if (gameState.settings.traitorCount >= gameState.players.length) {
alert('Cannot start game: Number of traitors must be less than total players!');
return;
}

// Assign roles
const shuffled = [...gameState.players].sort(() => Math.random() - 0.5);
const traitorNames = shuffled.slice(0, gameState.settings.traitorCount).map(p => p.name);

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
player.role = traitorNames.includes(player.name) ? 'traitor' : 'ally';
player.alive = true;
player.tasksCompleted = 0;

// Assign tasks based on role
const assignedTasks = [];
const isTraitor = player.role === 'traitor';

// Track which tasks and rooms have been used for this player
const usedTasks = new Set(); // Track task names to avoid duplicates
const usedRooms = new Set(); // Track rooms to prefer distinct rooms

// Create pools for this player
const availableNonUnique = [...allTasks];
const availableUnique = isTraitor ? [] : [...uniqueTasks];

// Shuffle available tasks for randomness
availableNonUnique.sort(() => Math.random() - 0.5);
availableUnique.sort(() => Math.random() - 0.5);

// Build room-based task pool for easy distinct-room selection
const tasksByRoom = {};
availableNonUnique.forEach(task => {
if (!tasksByRoom[task.room]) {
tasksByRoom[task.room] = [];
}
tasksByRoom[task.room].push(task);
});

// Assign the required number of tasks
for (let i = 0; i < gameState.settings.tasksPerPlayer; i++) {
let taskAssigned = false;

// Try to assign unique task first (allies only, 30% chance)
if (availableUnique.length > 0 && Math.random() < 0.3) {
// Find a unique task that hasn't been used
for (let j = 0; j < availableUnique.length; j++) {
const uniqueTask = availableUnique[j];
const taskKey = `${uniqueTask.room}:${uniqueTask.task}`;
if (!usedTasks.has(taskKey)) {
assignedTasks.push(uniqueTask);
usedTasks.add(taskKey);
usedRooms.add(uniqueTask.room);
availableUnique.splice(j, 1); // Remove so it's not assigned to another player
taskAssigned = true;
break;
}
}
}

// If no unique task assigned, try to assign from a room not yet used
if (!taskAssigned) {
// Get rooms that haven't been used yet
const unusedRooms = Object.keys(tasksByRoom).filter(room => !usedRooms.has(room));

if (unusedRooms.length > 0) {
// Pick a random unused room
const randomRoom = unusedRooms[Math.floor(Math.random() * unusedRooms.length)];
const roomTasks = tasksByRoom[randomRoom];

// Find a task from this room that hasn't been used
for (const task of roomTasks) {
const taskKey = `${task.room}:${task.task}`;
if (!usedTasks.has(taskKey)) {
assignedTasks.push(task);
usedTasks.add(taskKey);
usedRooms.add(task.room);
taskAssigned = true;
break;
}
}
}

// If all rooms used or no unused task in unused rooms, pick any available task
if (!taskAssigned) {
for (const task of availableNonUnique) {
const taskKey = `${task.room}:${task.task}`;
if (!usedTasks.has(taskKey)) {
assignedTasks.push(task);
usedTasks.add(taskKey);
usedRooms.add(task.room);
taskAssigned = true;
break;
}
}
}
}

// If still no task assigned (all tasks exhausted), stop trying
if (!taskAssigned) {
break;
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
console.log('Stage set to playing, updating UI...');
document.getElementById('waiting-room').classList.add('hidden');
document.getElementById('game-phase').classList.remove('hidden');

displayGameplay();

// Update game state in database
console.log('Calling updateGameInDB() to sync stage to database...');
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
document.getElementById('role-text').className = 'role-revealed role-ally';

// Set player status text
const statusText = player.alive ? 'Alive' : 'Eliminated';
const statusElement = document.getElementById('player-status-text');
if (statusElement) {
statusElement.textContent = statusText;
statusElement.style.color = player.alive ? '#4caf50' : '#ff3838';
statusElement.style.fontWeight = 'bold';
}

// Force role to be hidden when displaying gameplay (game start or after meeting)
document.getElementById('role-hidden').classList.remove('hidden');
document.getElementById('role-revealed').classList.add('hidden');
document.getElementById('toggle-role-btn').textContent = 'Reveal Role';

// Display per-player emergency meetings remaining
const currentPlayer = gameState.players.find(p => p.name === myPlayerName);
const playerEmergencyMeetingsUsed = currentPlayer?.emergencyMeetingsUsed || 0;
document.getElementById('meetings-remaining').textContent =
gameState.settings.meetingLimit - playerEmergencyMeetingsUsed;

// Ensure call meeting button and meeting type selection are properly shown/hidden
const callMeetingBtn = document.getElementById('call-meeting-btn');
if (callMeetingBtn && callMeetingBtn.parentElement) {
// Show the call meeting button (hide meeting type selection)
callMeetingBtn.parentElement.classList.remove('hidden');
document.getElementById('meeting-type-selection').classList.add('hidden');

// Disable call meeting button for eliminated players
if (!player.alive) {
callMeetingBtn.disabled = true;
callMeetingBtn.style.opacity = '0.5';
callMeetingBtn.style.cursor = 'not-allowed';
} else {
callMeetingBtn.disabled = false;
callMeetingBtn.style.opacity = '1';
callMeetingBtn.style.cursor = 'pointer';
}
}

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

// Only allow allies to actually complete tasks (traitors' checks are cosmetic)
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

// Only update database for allies (traitors' tasks are dummy)
if (player.role === 'ally') {
// Update player in database
if (supabaseClient && currentGameId) {
updatePlayerInDB(player.name, {
tasks_completed: player.tasksCompleted
});
}

// Check if allies won
checkAllyVictory();
}
}

function checkAllyVictory() {
// Count total tasks and completed tasks for ALL allies (including eliminated)
// Eliminated allies' completed tasks still count toward victory
let totalAllyTasks = 0;
let completedAllyTasks = 0;

gameState.players.forEach(player => {
if (player.role === 'ally') {
totalAllyTasks += player.tasks.length;
completedAllyTasks += player.tasksCompleted || 0;
}
});

// Check if all tasks are completed
if (totalAllyTasks > 0 && completedAllyTasks >= totalAllyTasks) {
endGame('allies', 'All tasks completed!');
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

function showMeetingTypeSelection() {
// Hide the call meeting button
document.getElementById('call-meeting-btn').parentElement.classList.add('hidden');

// Show the meeting type selection
document.getElementById('meeting-type-selection').classList.remove('hidden');

// Get current player's emergency meetings used
const currentPlayer = gameState.players.find(p => p.name === myPlayerName);
const meetingsUsed = currentPlayer?.emergencyMeetingsUsed || 0;
const meetingsRemaining = gameState.settings.meetingLimit - meetingsUsed;

// Update emergency meeting button text
const emergencyBtn = document.getElementById('emergency-meeting-btn');
const emergencyText = document.getElementById('emergency-meetings-text');
emergencyText.textContent = `${meetingsRemaining} emergency meeting${meetingsRemaining !== 1 ? 's' : ''} remaining`;

// Enable/disable emergency meeting button based on meetings remaining
if (meetingsRemaining <= 0) {
emergencyBtn.disabled = true;
emergencyBtn.style.opacity = '0.5';
emergencyBtn.style.cursor = 'not-allowed';
} else {
// Ensure button is fully enabled and styled correctly
emergencyBtn.disabled = false;
emergencyBtn.style.opacity = '';  // Remove inline opacity to use CSS defaults
emergencyBtn.style.cursor = '';   // Remove inline cursor to use CSS defaults
emergencyBtn.style.background = ''; // Remove any lingering background override
}
}

async function selectMeetingType(type) {
if (type === 'cancel') {
// Hide meeting type selection and show call meeting button again
document.getElementById('meeting-type-selection').classList.add('hidden');
document.getElementById('call-meeting-btn').parentElement.classList.remove('hidden');
return;
}

// Set meeting type
gameState.meetingType = type;

// If emergency meeting, increment this player's count
if (type === 'emergency') {
const currentPlayer = gameState.players.find(p => p.name === myPlayerName);
if (currentPlayer) {
currentPlayer.emergencyMeetingsUsed = (currentPlayer.emergencyMeetingsUsed || 0) + 1;

// Sync to database
if (supabaseClient && currentGameId) {
await updatePlayerInDB(myPlayerName, {
emergency_meetings_used: currentPlayer.emergencyMeetingsUsed
});
}
}
}

// Hide meeting type selection
document.getElementById('meeting-type-selection').classList.add('hidden');

// Trigger the actual meeting
await triggerMeeting();
}

async function triggerMeeting() {
// Set this player as the meeting caller
gameState.meetingCaller = myPlayerName;
console.log('Meeting called by:', myPlayerName, 'Type:', gameState.meetingType);

// Update database to trigger meeting for all players
if (supabaseClient && currentGameId) {
try {
const { error } = await supabaseClient
.from('games')
.update({
stage: 'meeting',
meeting_type: gameState.meetingType,
meeting_caller: gameState.meetingCaller,
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

function callMeeting() {
// Show meeting type selection instead of immediate meeting
showMeetingTypeSelection();
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
// Host meta-game controls (mark eliminations, etc.) are always available
// regardless of whether the host player is alive or eliminated
if (isHost()) {
const toggleBtn = document.getElementById('toggle-elimination-controls-btn');
toggleBtn.classList.remove('hidden');
toggleBtn.disabled = false; // Re-enable for new meeting (was disabled during previous voting)
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
// Only count alive players for ready status
const alivePlayers = gameState.players.filter(p => p.alive);
const totalAliveCount = alivePlayers.length;
const readyCount = Object.keys(gameState.meetingReady || {}).filter(playerName => {
const player = gameState.players.find(p => p.name === playerName);
return player && player.alive;
}).length;

document.getElementById('ready-for-vote-count').textContent = readyCount;
document.getElementById('total-players-count').textContent = totalAliveCount;

// Update ready players list (only alive players)
const readyList = document.getElementById('players-ready-list');
const readyPlayers = Object.keys(gameState.meetingReady || {}).filter(playerName => {
const player = gameState.players.find(p => p.name === playerName);
return player && player.alive;
});
readyList.textContent = readyPlayers.length > 0
? readyPlayers.join(', ')
: 'None yet';

// Show start voting button to host if all ALIVE players are ready
if (isHost() && readyCount === totalAliveCount && totalAliveCount > 0) {
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
gameState.votesTallied = false; // Reset for new voting session
gameState.settings.voteResults = null; // Clear old vote results from previous meeting

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
// Disable host elimination controls once voting starts
const toggleBtn = document.getElementById('toggle-elimination-controls-btn');
if (toggleBtn) {
toggleBtn.disabled = true;
}
// Hide the controls section if it's open
document.getElementById('host-elimination-controls')?.classList.add('hidden');

document.getElementById('discussion-phase').classList.add('hidden');
document.getElementById('voting-phase').classList.remove('hidden');

// Check if this player is eliminated
const currentPlayer = gameState.players.find(p => p.name === myPlayerName);
const isEliminated = currentPlayer && !currentPlayer.alive;

// Reset vote selection
selectedVote = null;
document.getElementById('submit-vote-btn').disabled = true;

// Show player status list
const statusList = document.getElementById('vote-player-status-list');
statusList.innerHTML = '';

// Sort players alphabetically by name
const sortedPlayersForStatus = [...gameState.players].sort((a, b) =>
  a.name.localeCompare(b.name)
);

sortedPlayersForStatus.forEach(player => {
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

if (isEliminated) {
// Eliminated players cannot vote - show message instead
voteOptions.innerHTML = `
<div style="padding: 20px; text-align: center; color: #a0a0a0;">
<p style="font-size: 1.1rem; margin-bottom: 10px;">You have been eliminated</p>
<p>You can observe the voting but cannot cast a vote.</p>
</div>
`;
document.getElementById('submit-vote-btn').style.display = 'none';
// Hide timer and vote labels for eliminated players
document.getElementById('vote-timer-label').style.display = 'none';
document.getElementById('vote-to-eliminate-label').style.display = 'none';
} else {
// Living players can vote
// Show timer and vote labels for alive players
document.getElementById('vote-timer-label').style.display = 'block';
document.getElementById('vote-to-eliminate-label').style.display = 'block';

// Sort alive players alphabetically by name
const sortedAlivePlayers = gameState.players
  .filter(p => p.alive)
  .sort((a, b) => a.name.localeCompare(b.name));

sortedAlivePlayers.forEach(player => {
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
document.getElementById('submit-vote-btn').style.display = 'block';
}

// Start vote timer (only for alive players)
if (!isEliminated) {
let timeLeft = gameState.settings.meetingTimer;
document.getElementById('vote-timer').textContent = timeLeft;

const interval = setInterval(() => {
timeLeft--;
document.getElementById('vote-timer').textContent = timeLeft;

if (timeLeft <= 0) {
clearInterval(interval);
console.log('=== VOTING TIMER EXPIRED ===');
console.log('Current selectedVote:', selectedVote);
console.log('myPlayerName:', myPlayerName);
// Auto-skip if no vote selected
if (!selectedVote) {
selectedVote = 'skip';
console.log('No vote selected - auto-setting to skip');
}
// Disable button to prevent double-submit
document.getElementById('submit-vote-btn').disabled = true;
// Submit vote (async - will update database and trigger vote tallying)
console.log('Calling submitVote() for timeout with vote:', selectedVote);
submitVote().then(() => {
console.log('✓ Timeout vote submitted successfully');
}).catch(err => {
console.error('✗ Error submitting timeout vote:', err);
});
}
}, 1000);
} else {
// Eliminated players don't see timer - they'll see results when they're ready
document.getElementById('vote-timer').textContent = 'Waiting for voting to complete...';
}
}

let selectedVote = null;

// Setter function for selectedVote (needed for testing)
function setSelectedVote(value) {
  selectedVote = value;
}

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
console.log('=== SUBMIT VOTE CALLED ===');
console.log('myPlayerName:', myPlayerName);
console.log('selectedVote:', selectedVote);
console.log('Current gameState.votes:', gameState.votes);

// Disable submit button to prevent double-voting
document.getElementById('submit-vote-btn').disabled = true;

// Record this player's vote using atomic database operation with retry
console.log('Recording vote:', selectedVote || 'skip', 'for player:', myPlayerName);

if (supabaseClient && currentGameId) {
const voteValue = selectedVote || 'skip';
let retries = 0;
const maxRetries = 5;

while (retries < maxRetries) {
try {
console.log(`Attempt ${retries + 1}/${maxRetries}: Submitting vote to database...`);

// Fetch current settings
const { data: currentGame, error: fetchError } = await supabaseClient
.from('games')
.select('settings')
.eq('id', currentGameId)
.single();

if (fetchError) throw fetchError;

// Check if our vote is already recorded
const existingVotes = currentGame.settings.votes || {};
if (existingVotes[myPlayerName] === voteValue) {
console.log('✓ Vote already recorded in database');
break;
}

// Merge our vote into settings
const updatedSettings = {
...currentGame.settings,
votes: {
...existingVotes,
[myPlayerName]: voteValue
}
};

// Update database
const { error: updateError } = await supabaseClient
.from('games')
.update({ settings: updatedSettings })
.eq('id', currentGameId);

if (updateError) throw updateError;

// Verify vote was recorded
await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms for sync
const { data: verifyGame } = await supabaseClient
.from('games')
.select('settings')
.eq('id', currentGameId)
.single();

if (verifyGame?.settings?.votes?.[myPlayerName] === voteValue) {
console.log('✓ Vote verified in database');
break;
} else {
console.warn(`Vote not verified, retrying... (attempt ${retries + 1})`);
retries++;
}
} catch (err) {
console.error(`✗ Error on attempt ${retries + 1}:`, err);
retries++;
await new Promise(resolve => setTimeout(resolve, 200)); // Wait before retry
}
}

if (retries >= maxRetries) {
console.error('✗ Failed to record vote after max retries');
}
} else {
// Offline mode - just update local state
if (!gameState.votes) gameState.votes = {};
gameState.votes[myPlayerName] = selectedVote || 'skip';
console.warn('No supabase client - vote only recorded locally');
}

// Show waiting screen for this player
document.getElementById('voting-phase').classList.add('hidden');
document.getElementById('vote-results').classList.remove('hidden');

// Show "Processing vote..." message instead of count
// The actual vote count will be updated by subscribeToGame() callback when database syncs
if (!gameState.votesTallied) {
document.getElementById('results-display').innerHTML = `
<p style="color: #5eb3f6;">Processing your vote...</p>
<p style="color: #a0a0a0;">Waiting for other players...</p>
`;
}

// Note: Vote tallying is handled by subscribeToGame() callback when all votes are in
// This prevents race conditions from checking local state before database sync completes
}

async function tallyVotes() {
console.log('=== tallyVotes() CALLED ===');
console.log('Current votes:', gameState.votes);
console.log('votesTallied flag:', gameState.votesTallied);

// Prevent double tallying
if (gameState.votesTallied) {
console.log('❌ Already tallied, returning early');
return;
}

// Check if all alive players have voted
const alivePlayers = gameState.players.filter(p => p.alive === true);
const votesSubmitted = Object.keys(gameState.votes).length;

console.log('Alive players:', alivePlayers.map(p => p.name));
console.log('Alive player count:', alivePlayers.length);
console.log('Votes submitted count:', votesSubmitted);
console.log('Players who voted:', Object.keys(gameState.votes));

if (votesSubmitted < alivePlayers.length) {
console.warn(`❌ Cannot tally: Only ${votesSubmitted} of ${alivePlayers.length} alive players have voted`);
const missingVoters = alivePlayers.filter(p => !gameState.votes[p.name]);
console.warn('Missing votes from:', missingVoters.map(p => p.name));
return; // Don't tally until all alive players have voted
}

console.log('✅ All alive players have voted, proceeding with tally...');
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

// Store vote results in settings so they sync to all players
gameState.settings.voteResults = {
voteCounts: voteCounts,
eliminatedPlayer: eliminatedPlayer,
isTie: isTie
};

// Display results immediately for current player to avoid "Processing..." message
// This prevents race condition where player sees "Processing your vote..."
// while waiting for database sync. The subscription will also call displayVoteResults
// for other players, but this ensures immediate feedback for the current context.
console.log('Displaying vote results immediately (before database sync)...');
displayVoteResults(voteCounts, eliminatedPlayer, isTie);

// Sync game state (including vote results) to database
if (supabaseClient && currentGameId) {
await updateGameInDB();
console.log('Vote results stored in database');
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

// Show resume button for host immediately (before subscription callback fires)
// This provides immediate feedback while maintaining centralized architecture
// All players (including host) will receive full results via subscribeToGame() callback
if (isHost()) {
const resumeBtn = document.getElementById('resume-game-btn');
if (resumeBtn) {
resumeBtn.classList.remove('hidden');
resumeBtn.disabled = false;
resumeBtn.textContent = 'Resume Game';
resumeBtn.className = 'btn-success btn-block';
console.log('Host: Resume button shown immediately after tallying');
}
}
}

function displayVoteResults(voteCounts, eliminatedPlayer, isTie) {
console.log('=== displayVoteResults() CALLED ===');
console.log('Vote counts:', voteCounts);
console.log('Eliminated player:', eliminatedPlayer);
console.log('Is tie:', isTie);
console.log('votesTallied flag:', gameState.votesTallied);
console.log('Current gameState.votes:', gameState.votes);
console.log('Alive players:', gameState.players.filter(p => p.alive).map(p => p.name));

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
ejectedText.textContent = `${eliminatedPlayer} was ejected. They were ${role === 'traitor' ? 'an Traitor' : 'a Ally'}.`;
} else {
ejectedText.textContent = 'No one was ejected.';
}

// Show appropriate button based on host status
// IMPORTANT: Host has a meta-game role separate from player role
// Host controls (resume, mark eliminations, etc.) are ALWAYS available to host
// regardless of whether the host player is alive or eliminated
const resumeBtn = document.getElementById('resume-game-btn');
const waitingMsg = document.getElementById('waiting-for-host-resume');

// Check if current player is host AND if they are eliminated
const currentPlayer = gameState.players.find(p => p.name === myPlayerName);
const hostIsEliminated = isHost() && currentPlayer && !currentPlayer.alive;

console.log('=== Resume Button Setup (displayVoteResults) ===');
console.log('isHost():', isHost());
console.log('Host is eliminated:', hostIsEliminated);
console.log('myPlayerName:', myPlayerName);
console.log('gameState.hostName:', gameState.hostName);

// Always show resume button, configure based on host status
resumeBtn.classList.remove('hidden');
waitingMsg.classList.add('hidden');

if (isHost()) {
console.log('→ HOST: Setting enabled resume button (meta-game role - works even if host is eliminated)');
resumeBtn.disabled = false;
resumeBtn.textContent = 'Resume Game';
resumeBtn.className = 'btn-success btn-block';
} else {
console.log('→ NON-HOST: Setting disabled button');
resumeBtn.disabled = true;
resumeBtn.textContent = 'Only Host Can Resume Game';
resumeBtn.className = 'btn-secondary btn-block';
}
console.log('Button state - disabled:', resumeBtn.disabled, 'text:', resumeBtn.textContent);
console.log('================================================');
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
const aliveTraitors = alivePlayers.filter(p => p.role === 'traitor').length;
const aliveAllies = alivePlayers.filter(p => p.role === 'ally').length;
const totalTraitors = gameState.players.filter(p => p.role === 'traitor').length;
const totalAllies = gameState.players.filter(p => p.role === 'ally').length;

console.log('=== Win Condition Check ===');
console.log(`Alive traitors: ${aliveTraitors}/${totalTraitors}`);
console.log(`Alive allies: ${aliveAllies}/${totalAllies}`);
console.log(`All players:`, gameState.players.map(p => ({ name: p.name, role: p.role, alive: p.alive })));

// Error check: Game malfunction if no traitors existed
if (totalTraitors === 0) {
console.error('ERROR: Game started with no traitors - this should never happen!');
throw new Error('Game malfunction: No traitors were assigned at game start');
}

// Allies win if all traitors are eliminated (and there were traitors to begin with)
if (aliveTraitors === 0 && totalTraitors > 0) {
console.log('WIN CONDITION: Allies win - all traitors eliminated');
return { winner: 'allies', reason: 'All traitors eliminated' };
}

// Traitors win if they equal or outnumber allies (and there are allies to outnumber)
if (aliveTraitors >= aliveAllies && aliveAllies > 0 && aliveTraitors > 0) {
console.log('WIN CONDITION: Traitors win - equal or outnumber allies');
return { winner: 'traitors', reason: 'Traitors equal or outnumber allies' };
}

console.log('WIN CONDITION: None met, game continues');
return null;
}

function resumeGame() {
// Only host can resume the game (button is disabled for non-hosts)
if (!isHost()) {
return;
}

// Don't allow resume if voting hasn't been completed
if (gameState.votingStarted && !gameState.votesTallied) {
return;
}

// Hide meeting and voting screens
document.getElementById('meeting-phase').classList.add('hidden');
document.getElementById('vote-results').classList.add('hidden');
document.getElementById('voting-phase').classList.add('hidden');
document.getElementById('discussion-phase').classList.add('hidden');

// Show game phase
document.getElementById('game-phase').classList.remove('hidden');
gameState.stage = 'playing';

// Reset meeting state
gameState.meetingReady = {};
gameState.votes = {};
gameState.votingStarted = false;
gameState.votesTallied = false;
gameState.meetingType = null;
gameState.meetingCaller = null;
gameState.settings.voteResults = null; // Clear vote results
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

// Allies win if winner is 'allies', traitors win if winner is 'traitors'
const didPlayerWin = (playerRole === 'ally' && winner === 'allies') ||
(playerRole === 'traitor' && winner === 'traitors');

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
// Host meta-game controls are always available regardless of alive/eliminated status
if (isHost()) {
document.getElementById('host-game-controls').classList.remove('hidden');
document.getElementById('non-host-game-controls').classList.add('hidden');
} else {
// Show non-host controls (Back to Menu button)
document.getElementById('host-game-controls').classList.add('hidden');
document.getElementById('non-host-game-controls').classList.remove('hidden');
}
}

function populateGameSummary() {
const summaryDiv = document.getElementById('game-summary');
const winningTeam = document.getElementById('winning-team');

// Set winning team text (normal color, not red or green)
if (gameState.winner === 'allies') {
winningTeam.textContent = 'Allies Win!';
winningTeam.style.color = '#ffffff';
} else if (gameState.winner === 'traitors') {
winningTeam.textContent = 'Traitors Win!';
winningTeam.style.color = '#ffffff';
}

// Separate players by role
const allies = gameState.players.filter(p => p.role === 'ally');
const traitors = gameState.players.filter(p => p.role === 'traitor');

// Calculate total ally tasks
const totalAllyTasks = allies.reduce((total, player) => {
return total + (player.tasksCompleted || 0);
}, 0);
const maxAllyTasks = allies.reduce((total, player) => {
return total + (player.tasks ? player.tasks.length : 0);
}, 0);

// Build summary HTML
summaryDiv.innerHTML = '';

// Allies Section
const alliesSection = document.createElement('div');
alliesSection.style.cssText = 'margin-bottom: 30px;';
alliesSection.innerHTML = `
<h3 style="color: #5eb3f6; margin-bottom: 15px;">Allies (${totalAllyTasks}/${maxAllyTasks} tasks completed)</h3>
`;

allies.forEach(player => {
const playerCard = document.createElement('div');
playerCard.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; margin-bottom: 10px; border-radius: 8px;';

const statusText = player.alive ? 'Alive' : 'Eliminated';

// Build tasks list
let tasksHTML = '<div style="margin-top: 10px;">';
if (player.tasks && player.tasks.length > 0) {
player.tasks.forEach((taskObj, index) => {
const completed = index < (player.tasksCompleted || 0);
const checkmark = completed ? '✓' : '○';
const color = completed ? '#ffffff' : '#a0a0a0';
tasksHTML += `<div style="color: ${color}; font-size: 0.9rem; margin: 3px 0;">${checkmark} ${taskObj.task} (${taskObj.room})</div>`;
});
} else {
tasksHTML += '<div style="color: #a0a0a0; font-size: 0.9rem;">No tasks</div>';
}
tasksHTML += '</div>';

playerCard.innerHTML = `
<div style="margin-bottom: 5px;">
<strong style="font-size: 1.1rem; color: #ffffff;">${player.name}</strong>
</div>
<div style="color: #a0a0a0; font-size: 0.9rem; margin-bottom: 5px;">${statusText}</div>
${tasksHTML}
`;

alliesSection.appendChild(playerCard);
});

summaryDiv.appendChild(alliesSection);

// Traitors Section
const traitorsSection = document.createElement('div');
traitorsSection.innerHTML = `
<h3 style="color: #5eb3f6; margin-bottom: 15px;">Traitors</h3>
`;

traitors.forEach(player => {
const playerCard = document.createElement('div');
playerCard.style.cssText = 'background: rgba(255,255,255,0.05); padding: 15px; margin-bottom: 10px; border-radius: 8px;';

const statusText = player.alive ? 'Alive' : 'Eliminated';

playerCard.innerHTML = `
<div style="margin-bottom: 5px;">
<strong style="font-size: 1.1rem; color: #ffffff;">${player.name}</strong>
</div>
<div style="color: #a0a0a0; font-size: 0.9rem;">${statusText}</div>
`;

traitorsSection.appendChild(playerCard);
});

summaryDiv.appendChild(traitorsSection);
}

function closeVictoryScreen() {
document.getElementById('victory-screen').classList.add('hidden');
}

function closeDefeatScreen() {
document.getElementById('defeat-screen').classList.add('hidden');
}

async function newGameSameSettings() {
if (!isHost()) return;

console.log('Host starting new game with same settings - creating NEW session');

// Save reference to old game ID for sending invitations
const previousGameId = currentGameId;
console.log('Previous game ID:', previousGameId);

// Unsubscribe from old game channels
unsubscribeFromChannels();

// Generate new room code for new session
const newRoomCode = generateRoomCode();
console.log('New room code:', newRoomCode);

// Reset game state but keep settings
gameState.players = [];
gameState.meetingsUsed = 0;
gameState.gameEnded = false;
gameState.stage = 'waiting';
gameState.winner = null;
gameState.meetingCaller = null;
gameState.meetingType = null;
gameState.roomCode = newRoomCode;

// Add host to players list (host is automatically ready since they initiated the new game)
if (myPlayerName) {
gameState.players.push({
name: myPlayerName,
ready: true,
role: null,
tasks: [],
tasksCompleted: 0,
alive: true,
votedFor: null,
emergencyMeetingsUsed: 0
});
}

// Create NEW game session in database
if (supabaseClient) {
await createGameInDB();
console.log('New game session created with ID:', currentGameId);

// Add host to players table in new game database
if (myPlayerName) {
await addPlayerToDB(myPlayerName, true);
console.log('Host added to new game players table');
}

// Send invitation to players from PREVIOUS game with new room code
if (previousGameId) {
console.log('Sending invitations to players from previous game');
try {
const { data: previousGame } = await supabaseClient
.from('games')
.select('settings')
.eq('id', previousGameId)
.single();

if (previousGame) {
await supabaseClient
.from('games')
.update({
settings: {
...previousGame.settings,
newGameInvitation: 'new_game',
newGameRoomCode: newRoomCode,
invitationTimestamp: new Date().toISOString()
}
})
.eq('id', previousGameId);

console.log('Invitation sent to previous players with new room code:', newRoomCode);
}
} catch (err) {
console.error('Error sending invitation:', err);
}
}
}

// Update room code display
document.getElementById('room-code').textContent = newRoomCode;

// Update displays
document.getElementById('min-players-display').textContent = gameState.settings.minPlayers;
document.getElementById('max-players-display').textContent = gameState.settings.maxPlayers;
document.getElementById('traitor-count-display').textContent = gameState.settings.traitorCount;

// Generate QR code for new session
generateQRCode();

// Clear all game end UI
document.getElementById('victory-screen').classList.add('hidden');
document.getElementById('defeat-screen').classList.add('hidden');
document.getElementById('game-summary').innerHTML = '';
document.getElementById('winning-team').textContent = '';
document.getElementById('host-game-controls').classList.add('hidden');

// Hide game end, show waiting room
document.getElementById('game-end').classList.add('hidden');
document.getElementById('waiting-room').classList.remove('hidden');

// Subscribe to new game channels
if (supabaseClient && currentGameId) {
subscribeToGame();
subscribeToPlayers();
}

// Start player existence check for new game
startPlayerExistenceCheck();

// Update UI sections
updateJoinSection();
updateLobby();
}

async function newGameNewSettings() {
if (!isHost()) return;

console.log('Host starting new game with new settings - going to setup');

// Save reference to old game ID for sending invitations later (after creating new game)
gameState.previousGameIdForInvites = currentGameId;
console.log('Saved previous game ID for invitations:', currentGameId);

// Unsubscribe from old game channels
unsubscribeFromChannels();

// Reset game state
gameState.players = [];
gameState.meetingsUsed = 0;
gameState.gameEnded = false;
gameState.stage = 'setup';
gameState.winner = null;
gameState.meetingCaller = null;
gameState.meetingType = null;
gameState.roomCode = '';
currentGameId = null;  // Clear current game ID - new one will be created when host clicks "Create Game"

// Clear all game end UI
document.getElementById('victory-screen').classList.add('hidden');
document.getElementById('defeat-screen').classList.add('hidden');
document.getElementById('game-summary').innerHTML = '';
document.getElementById('winning-team').textContent = '';
document.getElementById('host-game-controls').classList.add('hidden');

// Hide game end, show setup
document.getElementById('game-end').classList.add('hidden');
document.getElementById('setup-phase').classList.remove('hidden');

// Note: Invitations will be sent from createGame() after host configures settings
}

async function acceptNewGameInvitation() {
console.log('=== acceptNewGameInvitation called ===');
console.log('myPlayerName:', myPlayerName);

// Save player name for name confirmation modal
const savedPlayerName = myPlayerName;

// Get the new room code from the invitation
const newRoomCode = gameState.settings?.newGameRoomCode;
console.log('New game room code from invitation:', newRoomCode);

if (!newRoomCode) {
alert('Error: No room code found in invitation. Please try again.');
return;
}

// Stop player existence polling for old game
if (playerExistenceInterval) {
clearInterval(playerExistenceInterval);
setPlayerExistenceInterval(null);
}

// Unsubscribe from old game channels
unsubscribeFromChannels();

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

// Join the new game using the room code
const gameData = await joinGameFromDB(newRoomCode);

if (gameData) {
// Successfully joined new game
console.log('Joined new game session:', newRoomCode);

// Restore player name for name confirmation
setMyPlayerName(savedPlayerName);

// Show waiting room
document.getElementById('waiting-room').classList.remove('hidden');

// Update room code display to show new game code
document.getElementById('room-code').textContent = newRoomCode;

// Generate QR code for new game session
generateQRCode();

// Show name confirmation modal
console.log('Calling showNameConfirmation...');
showNameConfirmation();
} else {
alert(`Could not join new game. Room code: ${newRoomCode}`);
}
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
setMyPlayerName(newName); // Update the stored name
console.log('Name changed to:', nameToUse);
}

console.log('Player confirmed name:', nameToUse);

// Hide the modal
document.getElementById('name-confirmation-modal').classList.add('hidden');
console.log('Name confirmation modal hidden');

// Show waiting room
document.getElementById('waiting-room').classList.remove('hidden');
console.log('Waiting room shown');

// Check if player already exists (reconnection case)
const existingPlayer = gameState.players.find(p => p.name.toLowerCase() === nameToUse.toLowerCase());

if (existingPlayer) {
// Player exists - just mark them as ready
console.log('Player already exists - marking as ready');
await markPlayerReady(nameToUse);

// Update last_seen in database
if (supabaseClient && currentGameId) {
await updatePlayerInDB(nameToUse, { last_seen: new Date().toISOString() });
}
} else {
// New player - add them with ready=true since they confirmed their name
console.log('Adding new player with ready=true');
gameState.players.push({
name: nameToUse,
ready: true,
role: null,
tasks: [],
alive: true,
tasksCompleted: 0,
emergencyMeetingsUsed: 0
});

// Add to database with ready=true
if (supabaseClient && currentGameId) {
await addPlayerToDB(nameToUse, true);
}
}

// Update UI
updateJoinSection();
updateLobby();

// Start polling to detect if we get kicked
startPlayerExistenceCheck();
}

function declineJoinGame() {
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

// Export for testing and module usage
export {
  showCreateGame,
  showJoinGame,
  hideJoinGame,
  joinGameFromMenu,
  createGame,
  joinGame,
  returnToMenu,
  getGameURL,
  copyGameURL,
  generateQRCode,
  generateRoomCode,
  updateJoinSection,
  markPlayerReady,
  editPlayerName,
  kickPlayer,
  leaveGame,
  updateLobby,
  editSettings,
  startGame,
  displayGameplay,
  renderPlayerTasks,
  toggleTaskComplete,
  toggleRole,
  renderHostPlayerStatus,
  togglePlayerAlive,
  confirmTogglePlayerAlive,
  eliminatePlayer,
  toggleEliminationControls,
  closeEliminatedModal,
  updateHostControls,
  showInstructions,
  closeInstructions,
  callMeeting,
  showMeetingTypeSelection,
  selectMeetingType,
  acknowledgeMeeting,
  playAlarmSound,
  startDiscussionTimer,
  updateReadyStatus,
  hostStartVoting,
  startVoting,
  selectVote,
  setSelectedVote,
  submitVote,
  tallyVotes,
  displayVoteResults,
  resumeGame,
  checkWinConditions,
  checkAllyVictory,
  endGame,
  populateGameSummary,
  closeVictoryScreen,
  closeDefeatScreen,
  newGameSameSettings,
  showNameConfirmation,
  confirmPlayerName,
  editMyName,
  declineJoinGame,
  acceptNewGameInvitation,
  declineNewGameInvitation,
  newGameNewSettings,
  endSession
};

