// ==================== SUPABASE HELPER FUNCTIONS ====================

// MODULE VERSION CHECK - If you don't see this, browser is using cached version
console.log('🔄 supabase-backend.js loaded - VERSION 2024-11-26-18:00 - CLEANED UP JSONB');

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

// ==================== LOGGING SYSTEM ====================
const LOG_LEVELS = {
  ERROR: 0,
  INFO: 1,
  DEBUG: 2
};

let currentLogLevel = LOG_LEVELS.DEBUG;

function setLogLevel(level) {
  if (typeof level === 'string') {
    currentLogLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
  } else {
    currentLogLevel = level;
  }
  console.log(`Log level set to: ${Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === currentLogLevel)}`);
}

function logError(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

function logInfo(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    console.log(`[INFO] ${message}`, ...args);
  }
}

function logDebug(message, ...args) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

// Expose to window for runtime control
if (typeof window !== 'undefined') {
  window.setLogLevel = setLogLevel;
}


// ==================== SUBSCRIPTION MANAGER ====================
// Centralized subscription lifecycle management
class SubscriptionManager {
  constructor() {
    this.subscriptions = {
      game: null,
      players: null,
      meetingReady: null
    };
  }

  subscribe(type, channel) {
    // Cleanup previous subscription if exists
    if (this.subscriptions[type]) {
      this.unsubscribe(type);
    }

    this.subscriptions[type] = channel;
    logInfo(`✓ SubscriptionManager: Subscribed to ${type} channel`);
  }

  unsubscribe(type) {
    if (this.subscriptions[type] && supabaseClient) {
      supabaseClient.removeChannel(this.subscriptions[type]);
      this.subscriptions[type] = null;
      logInfo(`✓ SubscriptionManager: Unsubscribed from ${type} channel`);
    }
  }

  unsubscribeAll() {
    Object.keys(this.subscriptions).forEach(type => {
      this.unsubscribe(type);
    });
    logInfo('✓ SubscriptionManager: All subscriptions cleaned up');
  }

  getSubscription(type) {
    return this.subscriptions[type];
  }

  hasSubscription(type) {
    return this.subscriptions[type] !== null;
  }
}

// Global subscription manager instance
const subscriptionManager = new SubscriptionManager();

// ==================== UPDATE PROCESSING WITH SEQUENCE ORDERING ====================

function processGameUpdate(newData) {
  console.log('Processing game update - sequence:', newData.sequence_number);
  console.log('=== DATABASE COLUMN DEBUG ===');
  console.log('newData.meeting_ready:', newData.meeting_ready);
  console.log('newData.votes:', newData.votes);
  console.log('newData.vote_results:', newData.vote_results);
  console.log('newData.settings.meetingReady:', newData.settings?.meetingReady);
  console.log('newData.settings.votes:', newData.settings?.votes);
  console.log('============================');

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
    if (!isHost() && newData.settings.newGameInvitation && myPlayerName) {
      console.log('=== NEW GAME INVITATION DETECTED ===');
      console.log('Invitation type:', newData.settings.newGameInvitation);

      // Hide game end screen, waiting room, and show invitation modal
      document.getElementById('game-end').classList.add('hidden');
      document.getElementById('waiting-room').classList.add('hidden');
      document.getElementById('new-game-invitation').classList.remove('hidden');
      console.log('Invitation modal shown, game end and waiting room hidden');
    }
  }

  gameState.meetingsUsed = newData.meetings_used;
  gameState.gameEnded = newData.game_ended;
  gameState.winner = newData.winner;

  // Sync meeting-related state from dedicated columns (not settings JSONB)
  gameState.meetingReady = newData.meeting_ready || {};
  const incomingVotes = newData.votes || {};
  console.log('Syncing votes from database:', incomingVotes);
  console.log('Vote count from database:', Object.keys(incomingVotes).length);
  gameState.votes = incomingVotes;

  // These still come from settings
  if (newData.settings) {
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

    console.log('=== VOTE COUNT CHECK ===');
    console.log('Total players in gameState:', gameState.players.length);
    console.log('All players:', gameState.players.map(p => `${p.name}(alive:${p.alive})`));
    console.log('Alive players count:', totalAlivePlayers);
    console.log('Alive players:', alivePlayers.map(p => p.name));
    console.log('Votes submitted:', votesSubmitted);
    console.log('========================');

    // Check if vote results are available - display them for ALL players
    // Vote results are in settings (single writer - host only, no need for atomic)
    if (newData.settings && newData.settings.voteResults) {
      console.log('Vote results received from database, displaying for all players...');
      const { voteCounts, eliminatedPlayer, isTie } = newData.settings.voteResults;
      displayVoteResults(voteCounts, eliminatedPlayer, isTie);
    } else {
      // Update vote count display for players on results screen
      if (voteResultsVisible) {
        const resultsDisplay = document.getElementById('results-display');
        if (resultsDisplay) {
          if (votesSubmitted < totalAlivePlayers && !gameState.votesTallied) {
            resultsDisplay.innerHTML = `
              <p style="color: #a0a0a0;">Votes submitted: ${votesSubmitted}/${totalAlivePlayers}</p>
              <p style="color: #5eb3f6;">Waiting for all players to vote...</p>
            `;
          } else if (gameState.votesTallied && !newData.settings?.voteResults) {
            resultsDisplay.innerHTML = `
              <p style="color: #5eb3f6;">Tallying votes...</p>
              <p style="color: #a0a0a0;">Syncing results...</p>
            `;
          }
        }
      }

      // Host tallies votes when all ALIVE players have voted
      if (isHost() && votesSubmitted === totalAlivePlayers && !gameState.votesTallied) {
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
alive: Boolean(p.alive),
tasksCompleted: p.tasks_completed || 0,
votedFor: p.voted_for
}));

// Subscribe to realtime updates
await subscribeToGame();
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
return { success: false, error: 'Missing supabaseClient or currentGameId' };
}

try {
// Fetch current database state to merge meetingReady (prevents race condition)
const { data: currentGame, error: fetchError } = await supabaseClient
.from('games')
.select('settings')
.eq('id', currentGameId)
.single();

if (fetchError) throw fetchError;

// Update settings fields that are NOT in dedicated columns
// (votingStarted, meetingCaller, meetingType are still in settings - single writer, no concurrency)
gameState.settings.votingStarted = gameState.votingStarted;
gameState.settings.meetingCaller = gameState.meetingCaller;
gameState.settings.meetingType = gameState.meetingType;

// Remove old JSONB fields that now have dedicated columns (prevent accidental writes)
delete gameState.settings.meetingReady;
delete gameState.settings.votes;
// Note: voteResults stays in settings (single writer - host only, no concurrency issues)

console.log('Updating database with stage:', gameState.stage);
// NOTE: meeting_ready, votes, vote_results are ONLY written by atomic operations
// Do NOT write them here or they will overwrite atomic updates
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
return { success: true };
} catch (error) {
console.error('Error updating game:', error);
return { success: false, error: error.message };
}
}

async function updatePlayerInDB(playerName, updates) {
if (!supabaseClient || !currentGameId) {
return { success: false, error: 'Missing supabaseClient or currentGameId' };
}

try {
const { error } = await supabaseClient
.from('players')
.update(updates)
.eq('game_id', currentGameId)
.eq('name', playerName);

if (error) throw error;
return { success: true };
} catch (error) {
console.error('Error updating player:', error);
return { success: false, error: error.message };
}
}

async function removePlayerFromDB(playerName) {
if (!supabaseClient || !currentGameId) {
console.warn('Cannot remove player from DB - supabaseClient or currentGameId missing');
return { success: false, error: 'Missing supabaseClient or currentGameId' };
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
return { success: true };
} catch (error) {
console.error('Error removing player:', error);
return { success: false, error: error.message };
}
}

async function subscribeToGame() {
if (!supabaseClient || !currentGameId) return;

const channel = supabaseClient
.channel(`game:${currentGameId}`)
.on('postgres_changes',
{
event: 'UPDATE',
schema: 'public',
table: 'games',
filter: `id=eq.${currentGameId}`
},
(payload) => {
logDebug('=== GAME UPDATE RECEIVED ===');
processGameUpdate(payload.new);
}
)
.subscribe();

subscriptionManager.subscribe('game', channel);
setGameChannel(channel);
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

const channel = supabaseClient
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
.subscribe();

subscriptionManager.subscribe('players', channel);
setPlayersChannel(channel);
console.log('✓ Subscribed to player updates for game:', currentGameId);
}

function cleanupMeetingSubscription() {
subscriptionManager.unsubscribe('meetingReady');
gameState.meetingReadySubscription = null;
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
// Read from dedicated meeting_ready column (not settings JSONB)
const newMeetingReady = payload.new?.meeting_ready;
const oldMeetingReady = payload.old?.meeting_ready;

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

subscriptionManager.subscribe('meetingReady', meetingReadyChannel);
gameState.meetingReadySubscription = meetingReadyChannel;
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
console.log('=== PLAYER INSERT EVENT ===');
console.log('New player name:', newData.name);
console.log('New player data:', newData);
console.log('Current players in gameState:', gameState.players.map(p => p.name));
const existingIndex = gameState.players.findIndex(p => p.name === newData.name);
console.log('Duplicate check - existing index:', existingIndex);

if (existingIndex === -1) {
const newPlayer = {
name: newData.name,
role: newData.role,
ready: newData.ready,
tasks: newData.tasks || [],
alive: Boolean(newData.alive),
tasksCompleted: newData.tasks_completed || 0,
votedFor: newData.voted_for
};
gameState.players.push(newPlayer);
console.log('✓ Player added to local state:', newPlayer.name);
console.log('✓ New player count:', gameState.players.length);
console.log('✓ All players now:', gameState.players.map(p => `${p.name}(alive:${p.alive})`));
console.log('Calling updateLobby()...');
updateLobby();
} else {
console.warn('⚠️ Player already exists in local array, skipping INSERT');
console.warn('⚠️ Existing player:', gameState.players[existingIndex]);
}
console.log('=========================');
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
alive: Boolean(newData.alive),
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
// CRITICAL: Don't remove players during ENTIRE meeting phase to prevent race condition
// This protects both meeting discussion (ready count) AND voting (vote count)
// The voting snapshot will handle graceful degradation if player leaves
if (gameState.stage === 'meeting') {
  console.warn('⚠️  Cannot remove player during meeting phase:', oldData.name);
  console.warn('Player will be removed after meeting completes');

  // Mark player for deferred removal but don't remove yet
  gameState.players[playerIndex].pendingRemoval = true;

  // If it's this device's player, still redirect them
  if (oldData.name === myPlayerName && !isHost()) {
    alert('You have been removed from the game by the host.');
    returnToMenu();
  }
  return;  // Don't remove from array yet
}

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
subscriptionManager.unsubscribeAll();
setGameChannel(null);
setPlayersChannel(null);
gameState.meetingReadySubscription = null;
}

// ==================== ATOMIC OPERATIONS ====================
// These functions use database-level row locking to prevent race conditions

async function clearMeetingStateAtomic() {
  if (!supabaseClient || !currentGameId) {
    return { success: false, error: 'Missing supabaseClient or currentGameId' };
  }

  try {
    const { error } = await supabaseClient.rpc('clear_meeting_state', {
      game_uuid: currentGameId
    });

    if (error) throw error;

    logInfo('✓ Meeting state cleared atomically');
    return { success: true };
  } catch (error) {
    logError('Error clearing meeting state:', error);
    return { success: false, error: error.message };
  }
}

async function batchUpdatePlayersAtomic(playerUpdates) {
  if (!supabaseClient || !currentGameId) {
    return { success: false, error: 'Missing supabaseClient or currentGameId' };
  }

  try {
    const { error } = await supabaseClient.rpc('batch_update_players', {
      game_uuid: currentGameId,
      player_updates: playerUpdates
    });

    if (error) throw error;

    logInfo('✓ Batch player updates completed atomically');
    return { success: true };
  } catch (error) {
    logError('Error batch updating players:', error);
    return { success: false, error: error.message };
  }
}

async function submitVoteAtomic(playerName, voteValue) {
  if (!supabaseClient || !currentGameId) {
    return { success: false, error: 'Missing client or game ID' };
  }

  try {
    const { data, error } = await supabaseClient.rpc('submit_vote', {
      game_uuid: currentGameId,
      player_name: playerName,
      vote_value: voteValue
    });

    if (error) throw error;

    logInfo(`✓ Vote submitted atomically: ${playerName} -> ${voteValue}`);
    return { success: true, votes: data };
  } catch (error) {
    logError('✗ Error submitting vote:', error);
    return { success: false, error: error.message };
  }
}

async function acknowledgeMeetingAtomic(playerName) {
  if (!supabaseClient || !currentGameId) {
    return { success: false, error: 'Missing client or game ID' };
  }

  try {
    console.log('=== ATOMIC ACKNOWLEDGE DEBUG ===');
    console.log('Calling acknowledge_meeting RPC for:', playerName);

    const { data, error } = await supabaseClient.rpc('acknowledge_meeting', {
      game_uuid: currentGameId,
      player_name: playerName
    });

    console.log('RPC Response - data:', data);
    console.log('RPC Response - error:', error);
    console.log('================================');

    if (error) throw error;

    logInfo(`✓ Meeting ready acknowledged atomically: ${playerName}`);
    return { success: true, meetingReady: data };
  } catch (error) {
    logError('✗ Error acknowledging meeting:', error);
    return { success: false, error: error.message };
  }
}

// Export for testing and module usage
export {
  createGameInDB,
  joinGameFromDB,
  addPlayerToDB,
  updateGameInDB,
  updatePlayerInDB,
  removePlayerFromDB,
  clearMeetingStateAtomic,
  batchUpdatePlayersAtomic,
  submitVoteAtomic,
  acknowledgeMeetingAtomic,
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
