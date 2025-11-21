// ==================== SUPABASE CONFIGURATION ====================
// TODO: Replace these with your Supabase project credentials
// Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
const SUPABASE_URL = 'https://slmmwedexgtpxoyxfkey.supabase.co';  // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbW13ZWRleGd0cHhveXhma2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTA2NDksImV4cCI6MjA3ODQ2NjY0OX0.TDy1r0V3Sex-Zcldh29q_yvGeYi04o_KJ8haDQdOXUg';  // Your anon/public key

// Initialize Supabase client
let supabaseClient = null;
let gameChannel = null;
let playersChannel = null;
let currentGameId = null;

if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
try {
if (typeof supabase !== 'undefined') {
const { createClient } = supabase;
supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase client initialized successfully');
} else {
console.warn('Supabase library not loaded from CDN. Running in offline mode.');
}
} catch (error) {
console.error('Failed to initialize Supabase:', error);
console.warn('Running in offline mode.');
}
}
// =================================================================

// Game state object
let gameState = {
stage: 'setup',
roomCode: '',
hostName: null,
settings: {
minPlayers: 4,
maxPlayers: 10,
tasksPerPlayer: 4,
traitorCount: 1,
eliminationCooldown: 30,
cooldownReduction: 5,
meetingRoom: '',
meetingLimit: 1,
meetingTimer: 60,
additionalRules: '',
selectedRooms: {},
uniqueTasks: []
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

// Track the player name for this device
let myPlayerName = null;
let isGameCreator = false; // True if this device created the game
let playerExistenceInterval = null; // Interval for checking player existence

// Check if this device is the host
function isHost() {
// You're the host if you created the game OR if you're the named host
const result = isGameCreator || (gameState.hostName && myPlayerName === gameState.hostName);
console.log('isHost check - isGameCreator:', isGameCreator, '| hostName:', gameState.hostName, '| myPlayerName:', myPlayerName, '| result:', result);
return result;
}

// Setter functions for mutable module variables (needed for ES modules)
function setGameChannel(channel) {
  gameChannel = channel;
}

function setPlayersChannel(channel) {
  playersChannel = channel;
}

function setCurrentGameId(id) {
  currentGameId = id;
}

function setMyPlayerName(name) {
  myPlayerName = name;
}

function setIsGameCreator(value) {
  isGameCreator = value;
}

function setPlayerExistenceInterval(interval) {
  playerExistenceInterval = interval;
}

// Export for testing and module usage
export {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  supabaseClient,
  gameChannel,
  playersChannel,
  currentGameId,
  gameState,
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
};
