import { describe, it, expect, beforeEach, vi } from 'vitest'
import { handlePlayerChange } from '../js/supabase-backend.js'
import { gameState, setMyPlayerName } from '../js/game-state.js'

describe('Supabase Backend - Player Change Handling', () => {
  let mockUpdateLobby
  let mockDisplayGameplay

  beforeEach(() => {
    // Reset game state
    gameState.stage = 'waiting'
    gameState.players = []
    setMyPlayerName(null)

    // Mock UI update functions
    mockUpdateLobby = vi.fn()
    mockDisplayGameplay = vi.fn()

    // Expose mocks both globally and on window object (as they would be in the app)
    global.updateLobby = mockUpdateLobby
    global.displayGameplay = mockDisplayGameplay
    global.window = {
      updateLobby: mockUpdateLobby,
      displayGameplay: mockDisplayGameplay
    }

    // Mock DOM for updateLobby
    global.document = {
      getElementById: vi.fn(() => ({
        textContent: '',
        classList: { add: vi.fn(), remove: vi.fn() }
      })),
      querySelectorAll: vi.fn(() => []),
      body: { innerHTML: '' }
    }

    global.alert = vi.fn()

    vi.clearAllMocks()
  })

  describe('handlePlayerChange - UPDATE events', () => {
    it('should call updateLobby when in waiting stage', () => {
      // Setup
      gameState.stage = 'waiting'
      gameState.players = [
        { name: 'Player1', role: null, ready: false, tasks: [], alive: true, tasksCompleted: 0 }
      ]

      const payload = {
        eventType: 'UPDATE',
        new: {
          name: 'Player1',
          role: null,
          ready: true, // Player marked ready
          tasks: [],
          alive: true,
          tasks_completed: 0,
          voted_for: null,
          emergency_meetings_used: 0
        },
        old: {
          name: 'Player1',
          ready: false
        }
      }

      // Execute
      handlePlayerChange(payload)

      // Verify updateLobby was called (waiting room UI update)
      expect(mockUpdateLobby).toHaveBeenCalled()
      expect(mockDisplayGameplay).not.toHaveBeenCalled()
    })

    it('should call displayGameplay when in playing stage (regression test)', () => {
      // Regression test: When game starts, host assigns roles/tasks to all players
      // and updates database. Non-host players receive UPDATE events with their
      // role/task data. handlePlayerChange must call displayGameplay() to show
      // the role/tasks on the gameplay screen, not updateLobby() which only
      // updates the waiting room.

      // Setup - game has started
      gameState.stage = 'playing'
      gameState.players = [
        { name: 'Player1', role: null, ready: true, tasks: [], alive: true, tasksCompleted: 0 }
      ]
      setMyPlayerName('Player1')

      const payload = {
        eventType: 'UPDATE',
        new: {
          name: 'Player1',
          role: 'ally', // Role assigned by host
          ready: true,
          tasks: [{ room: 'Kitchen', task: 'Cook Food' }], // Tasks assigned by host
          alive: true,
          tasks_completed: 0,
          voted_for: null,
          emergency_meetings_used: 0
        },
        old: {
          name: 'Player1',
          role: null,
          tasks: []
        }
      }

      // Execute
      handlePlayerChange(payload)

      // Verify displayGameplay was called (gameplay UI update)
      expect(mockDisplayGameplay).toHaveBeenCalled()
      expect(mockUpdateLobby).not.toHaveBeenCalled()

      // Verify player data was updated locally
      expect(gameState.players[0].role).toBe('ally')
      expect(gameState.players[0].tasks).toHaveLength(1)
    })

    it('should update player data in gameState', () => {
      gameState.stage = 'waiting'
      gameState.players = [
        { name: 'Player1', role: null, ready: false, tasks: [], alive: true, tasksCompleted: 0 }
      ]

      const payload = {
        eventType: 'UPDATE',
        new: {
          name: 'Player1',
          role: 'ally',
          ready: true,
          tasks: [{ room: 'Kitchen', task: 'Test' }],
          alive: true,
          tasks_completed: 2,
          voted_for: 'Player2',
          emergency_meetings_used: 1
        },
        old: {}
      }

      handlePlayerChange(payload)

      expect(gameState.players[0]).toEqual({
        name: 'Player1',
        role: 'ally',
        ready: true,
        tasks: [{ room: 'Kitchen', task: 'Test' }],
        alive: true,
        tasksCompleted: 2,
        votedFor: 'Player2',
        emergencyMeetingsUsed: 1
      })
    })

    it('should handle player not found in local array', () => {
      gameState.players = []

      const payload = {
        eventType: 'UPDATE',
        new: { name: 'NonExistentPlayer', role: null, ready: true },
        old: {}
      }

      // Should not crash
      expect(() => handlePlayerChange(payload)).not.toThrow()
      expect(mockUpdateLobby).not.toHaveBeenCalled()
      expect(mockDisplayGameplay).not.toHaveBeenCalled()
    })
  })

  describe('handlePlayerChange - INSERT events', () => {
    it('should add new player and call updateLobby', () => {
      gameState.stage = 'waiting'
      gameState.players = []

      const payload = {
        eventType: 'INSERT',
        new: {
          name: 'Player1',
          role: null,
          ready: true,
          tasks: [],
          alive: true,
          tasks_completed: 0,
          voted_for: null
        },
        old: null
      }

      handlePlayerChange(payload)

      expect(gameState.players).toHaveLength(1)
      expect(gameState.players[0].name).toBe('Player1')
      expect(mockUpdateLobby).toHaveBeenCalled()
    })

    it('should not add duplicate player', () => {
      gameState.stage = 'waiting'
      gameState.players = [
        { name: 'Player1', role: null, ready: true, tasks: [], alive: true, tasksCompleted: 0 }
      ]

      const payload = {
        eventType: 'INSERT',
        new: {
          name: 'Player1',
          role: null,
          ready: true,
          tasks: [],
          alive: true,
          tasks_completed: 0
        },
        old: null
      }

      handlePlayerChange(payload)

      // Should still only have 1 player
      expect(gameState.players).toHaveLength(1)
    })
  })
})
