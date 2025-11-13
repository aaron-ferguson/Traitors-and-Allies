# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Among Us IRL is a single-page web application for managing in-person Among Us gameplay. The entire application is contained in one `index.html` file with no build process or external dependencies.

## Deployment

- **Platform**: Vercel
- **Repository**: https://github.com/aaron-ferguson/Among-Us-IRL
- **Deployment**: Automatic on push to main branch
- **Critical**: `index.html` must be at repository root for Vercel to serve it correctly

## Architecture

### Single-File Structure
Everything is in `index.html`:
- Inline CSS (`<style>` tag)
- Inline JavaScript (`<script>` tag)
- All HTML markup

### State Management
Central `gameState` object manages all application state:
```javascript
gameState = {
    stage: 'setup' | 'waiting' | 'playing' | 'meeting' | 'ended',
    roomCode: string,
    settings: {
        minPlayers, maxPlayers, tasksPerPlayer, imposterCount,
        eliminationCooldown, cooldownReduction,
        meetingRoom, meetingLimit, meetingTimer,
        selectedRooms: {
            [roomName]: {
                enabled: boolean,
                tasks: [{ name, enabled, unique }]
            }
        },
        uniqueTasks: []
    },
    players: [{ name, role, tasks, completedTasks, isAlive, votedFor }],
    currentPlayer: string,
    roleRevealed: boolean,
    meetingsUsed: number,
    gameEnded: boolean,
    winner: 'crewmates' | 'imposters'
}
```

### Core Data Structure
`ROOMS_AND_TASKS` constant (lines ~961-1010) contains 10 preset rooms with 28+ tasks:
- Anywhere, Outside, Living Room, Kitchen, Garage
- Bedrooms, Bathrooms, Closets, Office, Other

This is the source of truth for all game locations and activities.

### Key Rendering Pattern
1. **Initialize**: `initializeRoomsAndTasks()` populates `gameState.settings.selectedRooms` from `ROOMS_AND_TASKS`
2. **Render**: `renderAllRooms()` iterates through `gameState.settings.selectedRooms` and calls `renderRoom()` for each
3. **Dynamic Updates**: DOM manipulation functions update both DOM and `gameState` simultaneously

**Critical Bug Fix**: The "Add Room" button has ID `add-room-btn`. When rendering rooms, always use `getElementById('add-room-btn')` to locate it, NOT `querySelector('button')` which can return wrong buttons and cause insertBefore errors.

### Stage Flow
1. **Setup**: Host configures game settings, rooms/tasks (CRUD operations available)
2. **Waiting Room**: Jackbox-style room code, players join, ready status
3. **Playing**: Role assignment, task tracking, view switcher, elimination mechanics
4. **Meeting**: Emergency meeting UI with voting, discussion timer, player reports
5. **Ended**: Win/defeat screens with game summary

### CRUD Operations for Rooms/Tasks
- Rooms and tasks can be added, edited, or deleted during setup
- All modifications update `gameState.settings.selectedRooms`
- Preset rooms from `ROOMS_AND_TASKS` are treated identically to user-created ones
- Changes trigger re-render via `renderRoom()` or `renderTask()`

## Technology Stack

**Pure vanilla JavaScript** - No frameworks, libraries, or build tools:
- ES6+ JavaScript
- CSS3 with animations
- Web APIs: Clipboard, Web Audio, Vibration

**No backend** - Everything runs client-side. State is lost on page refresh.

## Common Issues

### Browser Caching
After making changes, users must hard-refresh to see updates:
- **Mac**: `Cmd + Shift + R`
- **Windows**: `Ctrl + Shift + R`

### File Location Confusion
Only the root `index.html` matters for deployment. If `/among-us-manager/index.html` exists, it's outdated and should be deleted.

### Debugging
Console logs are present in initialization functions. Check browser console for:
- Room count and names during initialization
- Rendering progress
- Any JavaScript errors

## Design Constraints

1. **Single HTML file** - Keep everything in one file for simplicity
2. **No external dependencies** - Pure vanilla stack only
3. **Client-side only** - No persistent storage or multi-device sync
4. **View switcher pattern** - Simulates multiple devices in single browser for testing
5. **Host-centric** - UI designed from host perspective with player view simulation

## Known Limitations

- No persistent storage (refresh = lost game state)
- No real-time sync between devices
- Room codes are cosmetic (no actual room validation)
- Limited to one game instance per device/browser tab
