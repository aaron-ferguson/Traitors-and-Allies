// ==================== SUPABASE HELPER FUNCTIONS ====================

// Import from game-state module
import {
  gameState,
  supabaseClient,
  gameChannel,
  playersChannel,
  currentGameId,
  myPlayerName,
  isGameCreator,
  playerExistenceInterval,
  isHost,
  setGameChannel,
  setPlayersChannel,
  setCurrentGameId,
  setMyPlayerName,
  setIsGameCreator,
  setPlayerExistenceInterval
} from './game-state.js';
import { ROOMS_AND_TASKS } from './rooms-and-tasks.js';

// Track last rendered stage to avoid unnecessary DOM rebuilds that can reset scroll position
let lastRenderedStage = null;

async function createGameInDB() {
if (!supabaseClient) {
console.warn('Supabase not configured - running in offline mode');
return null;
}

try {
const { data, error } = await supabaseClient
.from('games')
.insert({
room_code: gameState.roomCode,
host_name: null,  // Explicitly set as null initially, will be set when creator joins
stage: gameState.stage,
settings: gameState.settings,
meetings_used: gameState.meetingsUsed,
game_ended: gameState.gameEnded,
winner: gameState.winner
})
.select()
.single();

if (error) throw error;

setCurrentGameId(data.id);
console.log('Game created in DB:', data.id);

// Subscribe to realtime updates
subscribeToGame();
subscribeToPlayers();

return data;
} catch (error) {
console.error('Error creating game:', error);
alert('Failed to create game in database. Playing in offline mode.');
return null;
}
}

async function joinGameFromDB(roomCode) {
if (!supabaseClient) {
console.warn('Supabase not configured');
return null;
}

try {
// Fetch game by room code
const { data: gameData, error: gameError } = await supabaseClient
.from('games')
.select('*')
.eq('room_code', roomCode)
.single();

if (gameError) throw gameError;

setCurrentGameId(gameData.id);

// Load game state
gameState.roomCode = gameData.room_code;
gameState.hostName = gameData.host_name;
gameState.stage = gameData.stage;
gameState.settings = gameData.settings;
gameState.meetingsUsed = gameData.meetings_used;
gameState.gameEnded = gameData.game_ended;
gameState.winner = gameData.winner;

// CRITICAL: Validate selectedRooms after loading from database
// If missing or empty, reinitialize from ROOMS_AND_TASKS to prevent "no tasks" bug
if (!gameState.settings.selectedRooms || Object.keys(gameState.settings.selectedRooms).length === 0) {
  console.warn('selectedRooms missing or empty after DB load - reinitializing from ROOMS_AND_TASKS');
  gameState.settings.selectedRooms = {};

  // Populate with default rooms and tasks
  Object.keys(ROOMS_AND_TASKS).forEach(roomName => {
    gameState.settings.selectedRooms[roomName] = {
      enabled: true,
      tasks: ROOMS_AND_TASKS[roomName].map(task => ({
        name: task,
        enabled: true,
        unique: false
      }))
    };
  });

  console.log('✓ Reinitialized selectedRooms with', Object.keys(gameState.settings.selectedRooms).length, 'rooms');
}

// Fetch players
const { data: playersData, error: playersError } = await supabaseClient
.from('players')
.select('*')
.eq('game_id', currentGameId);

if (playersError) throw playersError;

gameState.players = playersData.map(p => ({
name: p.name,
role: p.role,
ready: p.ready,
tasks: p.tasks || [],
alive: p.alive,
tasksCompleted: p.tasks_completed || 0,
votedFor: p.voted_for
}));

// Subscribe to realtime updates
subscribeToGame();
subscribeToPlayers();

console.log('Joined game from DB:', gameData.id);
return gameData;
} catch (error) {
console.error('Error joining game:', error);
return null;
}
}

async function addPlayerToDB(playerName, ready = false) {
if (!supabaseClient || !currentGameId) {
console.warn('Supabase not configured or no game ID');
return null;
}

try {
const { data, error } = await supabaseClient
.from('players')
.insert({
game_id: currentGameId,
name: playerName,
ready: ready,
alive: true,
tasks: [],
tasks_completed: 0
})
.select()
.single();

if (error) throw error;

console.log('Player added to DB:', playerName, 'ready:', ready);
return data;
} catch (error) {
console.error('Error adding player:', error);
return null;
}
}

async function updateGameInDB() {
console.log('=== updateGameInDB() CALLED ===');
console.log('supabaseClient:', !!supabaseClient);
console.log('currentGameId:', currentGameId);
console.log('gameState.stage:', gameState.stage);

if (!supabaseClient || !currentGameId) {
console.warn('Cannot update game in DB - missing supabaseClient or currentGameId');
return;
}

try {
// Fetch current database state to merge meetingReady (prevents race condition)
const { data: currentGame, error: fetchError } = await supabaseClient
.from('games')
.select('settings')
.eq('id', currentGameId)
.single();

if (fetchError) throw fetchError;

// Merge local meetingReady with existing database state to prevent overwrites
const existingMeetingReady = currentGame?.settings?.meetingReady || {};
const mergedMeetingReady = { ...existingMeetingReady, ...gameState.meetingReady };

// Ensure meeting state is in settings for DB sync
gameState.settings.meetingReady = mergedMeetingReady;
gameState.settings.votes = gameState.votes;
gameState.settings.votingStarted = gameState.votingStarted;
gameState.settings.meetingCaller = gameState.meetingCaller;
gameState.settings.meetingType = gameState.meetingType;

console.log('Updating database with stage:', gameState.stage);
const { error } = await supabaseClient
.from('games')
.update({
stage: gameState.stage,
settings: gameState.settings,
meetings_used: gameState.meetingsUsed,
game_ended: gameState.gameEnded,
winner: gameState.winner
})
.eq('id', currentGameId);

if (error) throw error;
console.log('✓ Database updated successfully');
} catch (error) {
console.error('Error updating game:', error);
}
}

async function updatePlayerInDB(playerName, updates) {
if (!supabaseClient || !currentGameId) return;

try {
const { error } = await supabaseClient
.from('players')
.update(updates)
.eq('game_id', currentGameId)
.eq('name', playerName);

if (error) throw error;
} catch (error) {
console.error('Error updating player:', error);
}
}

async function removePlayerFromDB(playerName) {
if (!supabaseClient || !currentGameId) {
console.warn('Cannot remove player from DB - supabaseClient or currentGameId missing');
return;
}

try {
console.log('Deleting player from DB:', playerName, 'game_id:', currentGameId);
const { error } = await supabaseClient
.from('players')
.delete({ count: 'exact' })
.eq('game_id', currentGameId)
.eq('name', playerName)
.select();

if (error) throw error;
console.log('Player deleted from DB successfully');
} catch (error) {
console.error('Error removing player:', error);
}
}

function subscribeToGame() {
if (!supabaseClient || !currentGameId) return;

// Unsubscribe from previous channel if exists
if (gameChannel) {
supabaseClient.removeChannel(gameChannel);
}

setGameChannel(supabaseClient
.channel(`game:${currentGameId}`)
.on('postgres_changes',
{
event: 'UPDATE',
schema: 'public',
table: 'games',
filter: `id=eq.${currentGameId}`
},
(payload) => {
console.log('=== GAME UPDATE RECEIVED ===');
console.log('Full payload:', payload);
const newData = payload.new;
console.log('New stage from DB:', newData.stage);
console.log('Current local stage:', gameState.stage);

// Update local state from DB
// Only update hostName if it's not null (prevent overwriting valid host with null)
if (newData.host_name !== null && newData.host_name !== undefined) {
gameState.hostName = newData.host_name;
}
gameState.stage = newData.stage;
console.log('Local stage updated to:', gameState.stage);

// Only update settings if they exist (prevent overwriting valid settings with null/undefined)
if (newData.settings !== null && newData.settings !== undefined) {
gameState.settings = newData.settings;

// Sync meetingType from settings if it exists
if (newData.settings.meetingType) {
gameState.meetingType = newData.settings.meetingType;
}

// Check for new game invitation (for non-host players only)
console.log('Checking for invitation - isHost:', isHost(), 'invitation:', newData.settings.newGameInvitation, 'myPlayerName:', myPlayerName);
if (!isHost() && newData.settings.newGameInvitation && myPlayerName) {
console.log('=== NEW GAME INVITATION DETECTED ===');
console.log('Invitation type:', newData.settings.newGameInvitation);

// Hide game end screen, waiting room, and show invitation modal
// This ensures players can see the invitation even if they're viewing game summary
document.getElementById('game-end').classList.add('hidden');
document.getElementById('waiting-room').classList.add('hidden');
document.getElementById('new-game-invitation').classList.remove('hidden');
console.log('Invitation modal shown, game end and waiting room hidden');
}
}

gameState.meetingsUsed = newData.meetings_used;
gameState.gameEnded = newData.game_ended;
gameState.winner = newData.winner;

// Sync meeting-related state
if (newData.settings) {
gameState.meetingReady = newData.settings.meetingReady || {};
const incomingVotes = newData.settings.votes || {};
console.log('Syncing votes from database:', incomingVotes);
console.log('Vote count from database:', Object.keys(incomingVotes).length);
gameState.votes = incomingVotes;
gameState.votingStarted = newData.settings.votingStarted || false;
gameState.meetingCaller = newData.settings.meetingCaller;
}

// If voting has started and we're in discussion phase, start voting
if (gameState.votingStarted && !document.getElementById('voting-phase').classList.contains('hidden') === false) {
const discussionVisible = !document.getElementById('discussion-phase').classList.contains('hidden');
if (discussionVisible && !isHost()) {
startVoting();
}
}

// Update ready status if in discussion
if (!document.getElementById('discussion-phase').classList.contains('hidden')) {
updateReadyStatus();
}

// Check if we're in voting or waiting for results
const voteResultsVisible = !document.getElementById('vote-results').classList.contains('hidden');
const votingPhaseVisible = !document.getElementById('voting-phase').classList.contains('hidden');

if (voteResultsVisible || votingPhaseVisible) {
// Only count alive players for voting
const alivePlayers = gameState.players.filter(p => p.alive);
const totalAlivePlayers = alivePlayers.length;
const votesSubmitted = Object.keys(gameState.votes).length;

// Check if vote results are available - display them for ALL players (including host and eliminated)
// This creates a centralized, event-driven architecture where all players react to database state equally
if (newData.settings && newData.settings.voteResults) {
console.log('Vote results received from database, displaying for all players...');
const { voteCounts, eliminatedPlayer, isTie } = newData.settings.voteResults;
displayVoteResults(voteCounts, eliminatedPlayer, isTie);
} else {
// Update vote count display for players on results screen (if applicable)
if (voteResultsVisible) {
const resultsDisplay = document.getElementById('results-display');
if (resultsDisplay) {
if (votesSubmitted < totalAlivePlayers && !gameState.votesTallied) {
// Still waiting for all votes to come in
resultsDisplay.innerHTML = `
<p style="color: #a0a0a0;">Votes submitted: ${votesSubmitted}/${totalAlivePlayers}</p>
<p style="color: #5eb3f6;">Waiting for all players to vote...</p>
`;
} else if (gameState.votesTallied && !newData.settings?.voteResults) {
// Votes have been tallied locally, waiting for database sync
resultsDisplay.innerHTML = `
<p style="color: #5eb3f6;">Tallying votes...</p>
<p style="color: #a0a0a0;">Syncing results...</p>
`;
}
}
}

// Host tallies votes when all ALIVE players have voted (works whether host is on voting or results screen)
if (isHost() && votesSubmitted === totalAlivePlayers && !gameState.votesTallied) {
// All votes are in! Tally them
console.log('All votes received, tallying... (host on', voteResultsVisible ? 'results' : 'voting', 'screen)');
tallyVotes();
}
}
}

// Update UI based on stage
console.log('Calling handleStageChange() with stage:', gameState.stage);
handleStageChange();

// Update host controls visibility
updateHostControls();
}
)
.subscribe());

console.log('Subscribed to game updates');
}

function subscribeToPlayers() {
console.log('=== SUBSCRIBING TO PLAYERS ===');
console.log('supabaseClient:', !!supabaseClient);
console.log('currentGameId:', currentGameId);

if (!supabaseClient || !currentGameId) {
console.warn('Cannot subscribe to players - missing supabaseClient or currentGameId');
return;
}

// Unsubscribe from previous channel if exists
if (playersChannel) {
console.log('Removing previous players channel');
supabaseClient.removeChannel(playersChannel);
}

setPlayersChannel(supabaseClient
.channel(`players:${currentGameId}`)
.on('postgres_changes',
{
event: '*',
schema: 'public',
table: 'players',
filter: `game_id=eq.${currentGameId}`
},
(payload) => {
console.log('=== PLAYERS SUBSCRIPTION CALLBACK ===');
console.log('Players changed:', payload);
handlePlayerChange(payload);
}
)
.subscribe());

console.log('✓ Subscribed to player updates for game:', currentGameId);
}

function cleanupMeetingSubscription() {
if (gameState.meetingReadySubscription) {
console.log('Cleaning up meeting ready subscription...');
supabaseClient.removeChannel(gameState.meetingReadySubscription);
gameState.meetingReadySubscription = null;
console.log('✓ Meeting ready subscription cancelled');
}
}

function subscribeToMeetingReady() {
console.log('=== SUBSCRIBING TO MEETING READY STATUS ===');

if (!supabaseClient || !currentGameId) {
console.warn('Cannot subscribe to meeting ready - missing supabaseClient or currentGameId');
return null;
}

// Subscribe to changes in the meetingReady object
const meetingReadyChannel = supabaseClient
.channel(`meeting-ready-${currentGameId}`)
.on(
'postgres_changes',
{
event: 'UPDATE',
schema: 'public',
table: 'games',
filter: `id=eq.${currentGameId}`
},
(payload) => {
console.log('=== MEETING READY SUBSCRIPTION CALLBACK ===');

// Only process if meetingReady changed
const newMeetingReady = payload.new?.settings?.meetingReady;
const oldMeetingReady = payload.old?.settings?.meetingReady;

if (JSON.stringify(newMeetingReady) !== JSON.stringify(oldMeetingReady)) {
console.log('Meeting ready status changed:', newMeetingReady);

// Update local state from database (source of truth)
gameState.meetingReady = newMeetingReady || {};

// Only update UI if player is in meeting phase
if (gameState.stage === 'meeting' &&
!document.getElementById('meeting-phase').classList.contains('hidden')) {
// Import updateReadyStatus from game-logic
if (window.updateReadyStatus) {
window.updateReadyStatus();
}
}

// Check if all players are ready (host only)
if (window.checkAllPlayersReady) {
window.checkAllPlayersReady();
}
}
}
)
.subscribe();

console.log('✓ Subscribed to meeting ready status for game:', currentGameId);
return meetingReadyChannel;
}

function startPlayerExistenceCheck() {
// Clear any existing interval
if (playerExistenceInterval) {
clearInterval(playerExistenceInterval);
setPlayerExistenceInterval(null);
}

// Wait 3 seconds before starting polling to ensure player is added to DB first
setTimeout(() => {
// Check every 2 seconds if this player still exists in the database
setPlayerExistenceInterval(setInterval(async () => {
if (!myPlayerName || !supabaseClient || !currentGameId) {
clearInterval(playerExistenceInterval);
setPlayerExistenceInterval(null);
return;
}

try {
const { data, error } = await supabaseClient
.from('players')
.select('name')
.eq('game_id', currentGameId)
.eq('name', myPlayerName)
.maybeSingle();

if (error || !data) {
// Player no longer exists in database - we were kicked!
console.log('Player existence check: Player not found in DB - we were kicked!');
clearInterval(playerExistenceInterval);
setPlayerExistenceInterval(null);
// Don't kick host back to menu - they may be editing settings or creating new game
// Only kick non-hosts who were actually removed by the host
if (!isHost()) {
alert('You have been removed from the game by the host.');
returnToMenu();
}
}
} catch (err) {
console.log('Player existence check error (likely kicked):', err);
clearInterval(playerExistenceInterval);
setPlayerExistenceInterval(null);
// Don't kick host back to menu - they may be editing settings or creating new game
// Only kick non-hosts who were actually removed by the host
if (!isHost()) {
alert('You have been removed from the game by the host.');
returnToMenu();
}
}
}, 2000));
}, 3000);
}

function handlePlayerChange(payload) {
console.log('=== PLAYER CHANGE EVENT ===');
console.log('Event type:', payload.eventType);
console.log('Payload:', payload);
console.log('Current gameState.players count:', gameState.players.length);

const { eventType, new: newData, old: oldData } = payload;

if (eventType === 'INSERT') {
// New player joined
console.log('INSERT event - new player:', newData.name);
const existingIndex = gameState.players.findIndex(p => p.name === newData.name);
console.log('Existing index:', existingIndex);
if (existingIndex === -1) {
gameState.players.push({
name: newData.name,
role: newData.role,
ready: newData.ready,
tasks: newData.tasks || [],
alive: newData.alive,
tasksCompleted: newData.tasks_completed || 0,
votedFor: newData.voted_for
});
console.log('Player added! New player count:', gameState.players.length);
console.log('Calling updateLobby()...');
updateLobby();
} else {
console.log('Player already exists in local array, skipping');
}
} else if (eventType === 'UPDATE') {
// Player updated
console.log('UPDATE event - player:', newData.name);
const playerIndex = gameState.players.findIndex(p => p.name === newData.name);
console.log('Player index:', playerIndex);
if (playerIndex !== -1) {
const existingPlayer = gameState.players[playerIndex];
// Merge update with existing data to preserve fields not included in the update
gameState.players[playerIndex] = {
...existingPlayer,
name: newData.name,
role: newData.role,
ready: newData.ready,
tasks: newData.tasks !== undefined && newData.tasks !== null ? newData.tasks : existingPlayer.tasks,
alive: newData.alive,
tasksCompleted: newData.tasks_completed !== undefined ? newData.tasks_completed : existingPlayer.tasksCompleted,
votedFor: newData.voted_for !== undefined ? newData.voted_for : existingPlayer.votedFor,
emergencyMeetingsUsed: newData.emergency_meetings_used !== undefined ? newData.emergency_meetings_used : existingPlayer.emergencyMeetingsUsed
};
console.log('Player updated! Updating UI...');
// Call appropriate UI update based on current stage
if (gameState.stage === 'playing') {
// If we're in the game, update the gameplay display
// Import displayGameplay from game-logic if needed
if (typeof window.displayGameplay === 'function') {
window.displayGameplay();
}
} else {
// If we're in waiting room, update lobby
updateLobby();
}
} else {
console.log('Player not found in local array, cannot update');
}
} else if (eventType === 'DELETE') {
// Player left or was kicked
console.log('DELETE event received for player:', oldData.name);
console.log('Current myPlayerName:', myPlayerName);

const playerIndex = gameState.players.findIndex(p => p.name === oldData.name);
if (playerIndex !== -1) {
gameState.players.splice(playerIndex, 1);

// Check if the deleted player is this device's player
if (oldData.name === myPlayerName) {
console.log('This device was kicked! Redirecting to menu...');

// This player was kicked - notify and redirect
// Don't show "kicked" message if this is the host (they're likely starting a new game)
if (!isHost()) {
alert('You have been removed from the game by the host.');
}

// Return to menu
returnToMenu();
} else {
console.log('Someone else was kicked, updating lobby');
// Someone else left/was kicked - just update lobby
updateLobby();
}
} else {
console.log('Player not found in local players array');
}
}
}

async function handleStageChange() {
console.log('=== handleStageChange called ===');
console.log('Current stage:', gameState.stage);
console.log('myPlayerName:', myPlayerName);
console.log('isHost():', isHost());
console.log('currentGameId:', currentGameId);

// Avoid rerendering the same stage repeatedly; it forces the page to jump to the top on mobile
if (gameState.stage === lastRenderedStage) {
console.log('Stage unchanged; skipping UI rebuild to preserve scroll position');
return;
}

lastRenderedStage = gameState.stage;

// Show/hide appropriate UI sections based on stage
if (gameState.stage === 'waiting') {
console.log('Stage is WAITING');
document.getElementById('setup-phase').classList.add('hidden');
document.getElementById('game-phase').classList.add('hidden');
document.getElementById('game-end').classList.add('hidden');

// Check if an invitation modal is currently showing
const invitationShowing = !document.getElementById('new-game-invitation').classList.contains('hidden');
const nameConfirmationShowing = !document.getElementById('name-confirmation-modal').classList.contains('hidden');

console.log('Invitation modal showing:', invitationShowing);
console.log('Name confirmation modal showing:', nameConfirmationShowing);

// Only hide waiting room if we're showing invitation or name confirmation
// Otherwise, show it normally (for initial game joins)
if (invitationShowing || nameConfirmationShowing) {
console.log('Hiding waiting room (modal is showing)');
document.getElementById('waiting-room').classList.add('hidden');
} else {
console.log('Showing waiting room (no modals)');
document.getElementById('waiting-room').classList.remove('hidden');
updateLobby();
}
} else if (gameState.stage === 'playing') {
console.log('Stage is PLAYING - transitioning to game phase');
console.log('myPlayerName:', myPlayerName);
console.log('gameState.currentPlayer:', gameState.currentPlayer);

// Set current player if not already set (for non-host players joining mid-game)
if (!gameState.currentPlayer && myPlayerName) {
gameState.currentPlayer = myPlayerName;
console.log('Set currentPlayer to:', myPlayerName);
}

// For non-host players, reload player data from DB to get roles/tasks
if (myPlayerName && supabaseClient && currentGameId) {
console.log('Loading player data from DB for:', myPlayerName);
try {
const { data, error } = await supabaseClient
.from('players')
.select('*')
.eq('game_id', currentGameId)
.eq('name', myPlayerName)
.single();

if (!error && data) {
// Update local player data with role and tasks from DB
const playerIndex = gameState.players.findIndex(p => p.name === myPlayerName);
if (playerIndex !== -1) {
gameState.players[playerIndex].role = data.role;
gameState.players[playerIndex].tasks = data.tasks || [];
gameState.players[playerIndex].tasksCompleted = data.tasks_completed || 0;
console.log('Loaded player data from DB:', data);
}
}
} catch (err) {
console.error('Error loading player data:', err);
}
}

console.log('Updating UI: hiding meeting/vote screens, showing game phase');
document.getElementById('waiting-room').classList.add('hidden');
document.getElementById('meeting-phase').classList.add('hidden');
document.getElementById('vote-results').classList.add('hidden');
document.getElementById('voting-phase').classList.add('hidden');
document.getElementById('discussion-phase').classList.add('hidden');
document.getElementById('game-phase').classList.remove('hidden');
console.log('Calling displayGameplay()...');
displayGameplay();
console.log('✓ Transition to playing stage complete');
} else if (gameState.stage === 'meeting') {
// Only show meeting alert if player hasn't acknowledged yet
const hasAcknowledged = gameState.meetingReady && gameState.meetingReady[myPlayerName];
const meetingPhaseVisible = !document.getElementById('meeting-phase').classList.contains('hidden');

// Start subscription to meeting ready status
if (!gameState.meetingReadySubscription) {
console.log('Starting meeting ready subscription...');
gameState.meetingReadySubscription = subscribeToMeetingReady();
}

if (!hasAcknowledged && !meetingPhaseVisible) {
console.log('Meeting stage detected, showing alert');
document.getElementById('meeting-location-alert').textContent = gameState.settings.meetingRoom;
document.getElementById('meeting-overlay').classList.remove('hidden');

// Play alarm sound for everyone
playAlarmSound();
} else {
console.log('Player already acknowledged meeting or in meeting phase');
}
} else if (gameState.stage === 'ended') {
// Game has ended - show end screen
console.log('Game ended stage detected');

// Hide other phases
document.getElementById('game-phase').classList.add('hidden');
document.getElementById('meeting-phase').classList.add('hidden');
document.getElementById('waiting-room').classList.add('hidden');

// Show game end screen
document.getElementById('game-end').classList.remove('hidden');

// Determine if this player won or lost
const player = gameState.players.find(p => p.name === myPlayerName);
const playerRole = player ? player.role : null;

// Allies win if winner is 'allies', traitors win if winner is 'traitors'
const didPlayerWin = (playerRole === 'ally' && gameState.winner === 'allies') ||
(playerRole === 'traitor' && gameState.winner === 'traitors');

// Show appropriate screen
if (didPlayerWin) {
document.getElementById('victory-screen').classList.remove('hidden');
document.getElementById('defeat-screen').classList.add('hidden');
if (gameState.settings && gameState.settings.meetingRoom) {
document.getElementById('meeting-location-victory').textContent = gameState.settings.meetingRoom;
}
} else {
document.getElementById('victory-screen').classList.add('hidden');
document.getElementById('defeat-screen').classList.remove('hidden');
if (gameState.settings && gameState.settings.meetingRoom) {
document.getElementById('meeting-location-defeat').textContent = gameState.settings.meetingRoom;
}
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
}

function unsubscribeFromChannels() {
if (gameChannel) {
supabaseClient.removeChannel(gameChannel);
setGameChannel(null);
}
if (playersChannel) {
supabaseClient.removeChannel(playersChannel);
setPlayersChannel(null);
}
// Also cleanup meeting ready subscription
cleanupMeetingSubscription();
}

// Export for testing and module usage
export {
  createGameInDB,
  joinGameFromDB,
  addPlayerToDB,
  updateGameInDB,
  updatePlayerInDB,
  removePlayerFromDB,
  subscribeToGame,
  subscribeToPlayers,
  subscribeToMeetingReady,
  cleanupMeetingSubscription,
  startPlayerExistenceCheck,
  handlePlayerChange,
  handleStageChange,
  unsubscribeFromChannels
};

// =================================================================
