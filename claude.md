# Among Us IRL - Game Manager

A web-based game manager for playing Among Us in real life with friends. This app helps organize in-person games by managing roles, tasks, and emergency meetings.

## Overview

This is a single-page web application that facilitates in-person Among Us gameplay by providing digital game management tools. Players use their own devices to join a game, receive secret role assignments, track tasks, and coordinate emergency meetings.

## Features

### 4-Stage Game Flow

#### Stage 1: Game Setup
- Host configures game settings:
  - Number of players (3-15)
  - Number of imposters (1-3)
  - Tasks per crewmate (1-10)
- Simple, clean interface for quick setup

#### Stage 2: Waiting Room
- **Room Code System** (Jackbox-style)
  - Randomly generated 4-character code
  - One-click copy button for easy sharing
  - Players self-join by entering their names
- Real-time player list updates
- Shows player count and imposter count
- Host controls when to start game (minimum 3 players required)

#### Stage 3: Game Play
- **Role Assignment**
  - Randomly assigns imposters and crewmates
  - Secret role reveal for each player
  - 20 different tasks randomly assigned to crewmates

- **View Switcher**
  - Host view: See all players, roles, and tasks
  - Individual player views: Simulate each player's screen
  - Useful for testing and managing the game

- **Task Tracking**
  - Crewmates can check off completed tasks
  - Task progress syncs across views
  - Imposters receive mission instructions

#### Stage 4: Emergency Meeting
- **Alert System**
  - Full-screen red flashing overlay
  - Loud alarm sound (10 beeps)
  - Phone vibration support
  - Clear "Return to meeting point" message
  - Dismissible when meeting is over

## Technology Stack

- **Pure Vanilla Stack**: No frameworks, libraries, or build tools
  - HTML5
  - CSS3 (with animations and gradients)
  - JavaScript (ES6+)
- **Single File**: Everything contained in one `index.html`
- **Client-Side Only**: No backend or database required
- **Web APIs Used**:
  - Clipboard API (copy room code)
  - Web Audio API (alarm sound)
  - Vibration API (mobile alerts)

## How to Use

### For the Host:
1. Open the app and configure game settings
2. Share the room code with players
3. Wait for players to join the lobby
4. Click "Start Game" when ready
5. Use the view switcher to help players see their roles
6. Click "Emergency Meeting" button when needed

### For Players:
1. Receive room code from host
2. Open the app and enter your name to join
3. Wait in lobby until game starts
4. Check your role (imposter or crewmate)
5. If crewmate: Complete your assigned tasks
6. If imposter: Sabotage and deceive
7. Respond to emergency meeting alerts

## Deployment

- **Hosted on**: Vercel
- **Repository**: https://github.com/aaron-ferguson/Among-Us-IRL
- **Auto-deploy**: Push to main branch triggers automatic deployment
- **Static Site**: No build process required

## Current Capabilities

✅ Configurable game settings
✅ Room code generation and sharing
✅ Self-service player joining
✅ Random role assignment
✅ 20 unique task types
✅ Task completion tracking
✅ Emergency meeting alerts with sound
✅ Multi-device simulation (view switcher)
✅ Responsive design (mobile-friendly)

## Future Enhancements

### Planned Features:
- **Emergency Meeting Enhancements**
  - Timer for discussion phase
  - Voting system
  - Vote results display
  - Skip vote option

- **Game Settings Expansion**
  - Configurable emergency meeting cooldown
  - Kill cooldown timer
  - Vision distance settings
  - Common tasks vs individual tasks

- **Multi-Device Support**
  - Real-time sync between devices (requires backend)
  - QR code for joining
  - Unique URLs per player to see only their role

- **Task Improvements**
  - Visual task indicators
  - Multi-step tasks
  - Task locations (rooms)
  - Common tasks that everyone has

- **Imposter Tools**
  - Sabotage options
  - Kill tracker
  - Vent locations

- **Game State Management**
  - Player elimination
  - Victory conditions (tasks complete vs imposters win)
  - End game screen with reveal

- **Polish**
  - Sound effects for actions
  - Better animations
  - Theme customization
  - Language support

### Technical Debt:
- Add proper state management (consider moving to React/Vue if complexity grows)
- Implement backend for true multi-device sync (Socket.io or Firebase)
- Add unit tests
- Improve accessibility (ARIA labels, keyboard navigation)
- Optimize for offline use (Service Worker/PWA)

## Development Notes

### Design Decisions:
1. **Single HTML File**: Keeps deployment simple, no build step
2. **No Backend**: Reduces complexity for initial version, but limits multi-device sync
3. **View Switcher**: Clever workaround for multi-device testing without backend
4. **Jackbox-Style Joining**: Familiar UX pattern that works well for party games

### Known Limitations:
- No persistent storage (refresh = lost game state)
- No real-time sync between devices
- Room codes are cosmetic (no actual room validation)
- Limited to one game instance per device/browser tab

### Architecture:
```
gameState object (in-memory)
├── stage: Current game phase
├── settings: Game configuration
├── roomCode: Generated 4-char code
├── players: Array of player objects
│   ├── name
│   ├── role (imposter/crewmate)
│   ├── tasks (if crewmate)
│   └── completedTasks
└── currentView: Which player view is active
```

## Credits

Built with Claude Code by Anthropic
Inspired by Among Us by Innersloth

---

Last Updated: 2025-11-11
