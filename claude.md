# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Traitors and Allies is a single-page web application for managing in-person Traitors and Allies gameplay. The application uses a modular architecture with separate CSS and JavaScript files for optimal performance and maintainability. No build process or external dependencies required.

## Deployment

- **Platform**: Vercel
- **Repository**: https://github.com/aaron-ferguson/Traitors-and-Allies
- **Deployment**: Automatic on push to main branch
- **Critical**: `index.html` must be at repository root for Vercel to serve it correctly

## Architecture

### Modular File Structure
The application is organized into focused modules for optimal Claude Code and app performance:

**Core Files:**
- `index.html` HTML markup only, references external resources
- `styles.css` All CSS styles with mobile-first responsive design

**JavaScript Modules (`js/` directory - 124KB total):**
- `rooms-and-tasks.js` - Game data constants (ROOMS_AND_TASKS)
- `game-state.js` - Global state object and Supabase configuration
- `supabase-backend.js` - Database operations and real-time subscriptions
- `room-task-manager.js` - Room/task CRUD, drag-drop, swipe-to-delete
- `game-logic.js` - All game flow functions (waiting room, gameplay, meetings, voting, session management)
- `init.js` - Application initialization

**Module Load Order:** Scripts must load in dependency order (as listed above).

**Benefits:**
- **For Claude Code**: Significant token reduction per task - work smart with specific smaller modules instead of a monolithic file
- **For Users**: Better browser caching, parallel downloads, faster initial parse time
- **For Developers**: Clear module boundaries, easier code navigation and maintenance

### State Management
Central `gameState` object manages all application state:
```javascript
gameState = {
    stage: 'setup' | 'waiting' | 'playing' | 'meeting' | 'ended',
    roomCode: string,
    settings: {
        minPlayers, maxPlayers, tasksPerPlayer, traitorCount,
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
    winner: 'allies' | 'traitors'
}
```

### Core Data Structure
`ROOMS_AND_TASKS` constant (in `js/rooms-and-tasks.js`) contains preset rooms with several tasks per room
This is the source of truth for all game locations and activities.

### Key Rendering Pattern
1. **Initialize**: `initializeRoomsAndTasks()` populates `gameState.settings.selectedRooms` from `ROOMS_AND_TASKS`
2. **Render**: `renderAllRooms()` iterates through `gameState.settings.selectedRooms` and calls `renderRoom()` for each
3. **Dynamic Updates**: DOM manipulation functions update both DOM and `gameState` simultaneously

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

**Frontend:**
- Pure vanilla JavaScript (ES6+)
- CSS3 with animations
- Single HTML file (no build process)
- Web APIs: Clipboard, Web Audio, Vibration

**Backend (Optional but Recommended):**
- Supabase for real-time multi-device sync
- PostgreSQL database (via Supabase)
- Real-time subscriptions (WebSocket-based)
- Row Level Security (RLS) for data protection

**Note:** App works offline (client-side only) if Supabase credentials not configured, but multi-device joining requires Supabase.

## Common Issues

### Browser Caching
After making changes, users must hard-refresh to see updates:
- **Mac**: `Cmd + Shift + R`
- **Windows**: `Ctrl + Shift + R`

### File Structure Requirements
All files must be at repository root for Vercel deployment:
- `index.html` - Main HTML file
- `styles.css` - Global styles
- `js/` directory - All JavaScript modules

The backup file `index.html.backup` (old monolithic version) can be deleted after verifying the modular version works correctly.

### Debugging
Console logs are present in initialization functions. Check browser console for:
- Room count and names during initialization
- Rendering progress
- Any JavaScript errors

## Design Constraints

1. **Modular architecture** - Separate CSS and JS files for optimal performance and maintainability
2. **No external dependencies** - Pure vanilla stack only (except Supabase CDN for multi-device sync)
3. **No build process** - Files are served as-is; no compilation, bundling, or transpilation required
4. **Real-time multiplayer architecture** - Requires Supabase backend for synchronizing game state across all player devices in real-time
5. **View switcher pattern** - Simulates multiple devices in single browser for testing
6. **Synchronized multiplayer** - All players share real-time game state; host performs administrative functions (setup, player elimination, meeting control)

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight.

Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.
- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.
- Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>

## Supabase Backend Setup

To enable multi-device support:
1. Follow instructions in `SUPABASE_SETUP.md`
2. Run `supabase-schema.sql` in Supabase SQL Editor
3. Add credentials to `js/game-state.js` (SUPABASE_URL and SUPABASE_ANON_KEY constants)
4. Deploy to Vercel

**Database Schema:**
- `games` table: Stores game state, settings, room codes
- `players` table: Stores player names, roles, tasks, status
- Automatic cleanup: Games expire after 4 hours
- RLS policies: Public read/write with time-based restrictions

**Real-time Sync:**
- Subscribe to game updates when entering waiting room
- Subscribe to player updates for lobby
- Unsubscribe when leaving/game ends
- All devices see changes in real-time via WebSocket

## Testing & Test-Driven Development (TDD)

This project maintains comprehensive unit test coverage using Vitest. All new features must include tests.

### Test Infrastructure

**Framework:** Vitest (ES module-native, fast, compatible with vanilla JS)

**Test Files:**
- `tests/game-state.test.js` (63 tests) - State management
- `tests/room-task-manager.test.js` (41 tests) - CRUD operations
- `tests/game-logic.test.js` (130 tests) - Game flow and business logic
- **Total: 234 passing tests**

**Running Tests:**
- To reduce token usage, never run tests. 
- Instead, prompt the user to run a test anytime you need to verify that tests are passing.
```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
```

### Test-Driven Development Workflow

When adding new features, follow this workflow:

1. **Write Tests First** - Create test file for business logic functions
2. **Run Tests** - Verify tests fail (red) by prompting the user to run the tests
3. **Implement Feature** - Write minimal code to pass tests
4. **Verify Tests Pass** - All 234+ tests green
5. **Commit** - Include tests in the same commit as feature code

### What to Test

**DO Test (High Value):**
- ✅ Business logic (calculations, algorithms, state changes)
- ✅ Complex conditionals and data transformations
- ✅ State management and mutations
- ✅ CRUD operations
- ✅ Game flow and state transitions
- ✅ Error handling and edge cases
- ✅ Win/loss conditions
- ✅ Player management
- ✅ Voting and elimination logic
- ✅ Task assignment algorithms

**DON'T Test (Low Value):**
- ❌ Simple DOM manipulation (getElementById, classList)
- ❌ Functions that only delegate to other functions
- ❌ Pure UI rendering without business logic
- ❌ External library wrappers (Supabase SDK)
- ❌ Static data constants
- ❌ Glue code (init.js)
- ❌ Animation/timer functions

Please write high-quality, general-purpose solutions using the standard tools available. Do not create helper scripts or workarounds to accomplish the task more efficiently. Implement a solution that works correctly for all valid inputs, not just the test cases. Do not hard-code values or create solutions that only work for specific test inputs. Instead, implement the actual logic that solves the problem generally.

Focus on understanding the problem requirements and implementing the correct algorithm. Tests are there to verify correctness, not to define the solution. Provide a principled implementation that follows best practices and software design principles.

If the task is unreasonable or infeasible, or if any of the tests are incorrect, please inform me rather than working around them. The solution should be robust, maintainable, and extendable.

### Test Organization

```javascript
// tests/new-module.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { functionToTest } from '../js/new-module.js'

describe('Module Name', () => {
  beforeEach(() => {
    // Reset state, mock DOM elements
  })

  describe('functionToTest', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = functionToTest(input)

      // Assert
      expect(result).toBe('expected')
    })

    it('should handle edge case', () => {
      // Test edge cases
    })
  })
})
```

### Mocking Strategy

**DOM Elements:**
```javascript
global.document = {
  getElementById: vi.fn((id) => mockElements[id] || defaultMock),
  querySelector: vi.fn(() => defaultMock),
  createElement: vi.fn(() => mockElement)
}
```

**Supabase (if needed):**
```javascript
vi.mock('../js/supabase-backend.js', () => ({
  updateGameInDB: vi.fn(),
  createGameInDB: vi.fn()
}))
```

### Coverage Goals

**Current Coverage: ✅ EXCELLENT**
- All critical business logic covered
- All complex algorithms tested
- All state management verified
- Edge cases and error conditions included

See `TEST_COVERAGE_ANALYSIS.md` for detailed coverage report.

### Pre-Commit Checklist

Before committing new features:
1. ✅ All tests pass (`npm test`)
2. ✅ New business logic has corresponding tests
3. ✅ Tests follow existing organization patterns
4. ✅ Mock setup is minimal and focused
5. ✅ Test descriptions are clear and specific

## Known Limitations

**With Supabase (Recommended):**
- Games expire after 4 hours (configurable in database)
- Free tier limits: 500MB database, 1GB bandwidth/month

**Without Supabase (Offline Mode):**
- No persistent storage (refresh = lost game state)
- No real-time sync between devices
- Room codes don't actually connect devices
- Each device has separate game state

## AI Behavioral Preferences

<focus_on_task_completion_instead_of_context_windows>
Your context window will be automatically compacted as it approaches its limit, allowing you to continue working indefinitely from where you left off. Therefore, do not stop tasks early due to token budget concerns. As you approach your token budget limit, save your current progress and state to memory before the context window refreshes. Always be as persistent and autonomous as possible and complete tasks fully, even if the end of your budget is approaching. Never artificially stop any task early regardless of the context remaining.
</focus_on_task_completion_instead_of_context_windows>

<do_not_act_before_instructions>
Do not jump into implementatation or changes files unless clearly instructed to make changes. When the user's intent is ambiguous, default to providing information, doing research, and providing recommendations rather than taking action. Only proceed with edits, modifications, or implementations when the user explicitly requests them or when they are part of a plan we have previously agreed to.
</do_not_act_before_instructions>

<investigate_before_answering>
Never speculate about code you have not opened. If the user references a specific file, you MUST read the file before answering. Make sure to investigate and read relevant files BEFORE answering questions about the codebase. Never make any claims about code before investigating unless you are certain of the correct answer - give grounded and hallucination-free answers.
</investigate_before_answering>

<subagent_delegation>
Only delegate to subagents when the task clearly benefits from a separate agent with a new context window.
</subagent_delegation>


