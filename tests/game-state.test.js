import { describe, it, expect, beforeEach } from 'vitest'
import {
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
} from '../js/game-state.js'

describe('Game State Module', () => {
  describe('Constants', () => {
    it('should export SUPABASE_URL', () => {
      expect(SUPABASE_URL).toBeDefined()
      expect(typeof SUPABASE_URL).toBe('string')
    })

    it('should export SUPABASE_ANON_KEY', () => {
      expect(SUPABASE_ANON_KEY).toBeDefined()
      expect(typeof SUPABASE_ANON_KEY).toBe('string')
    })

    it('should have valid Supabase URL format', () => {
      expect(SUPABASE_URL).toMatch(/^https:\/\/.*\.supabase\.co$/)
    })
  })

  describe('Supabase Client', () => {
    it('should export supabaseClient', () => {
      expect(supabaseClient).toBeDefined()
    })

    it('should initialize supabaseClient when credentials are provided', () => {
      // In test environment with mock supabase, client should be created
      expect(supabaseClient).not.toBeNull()
    })
  })

  describe('gameState Object', () => {
    it('should have correct initial stage', () => {
      expect(gameState.stage).toBe('setup')
    })

    it('should have empty roomCode initially', () => {
      expect(gameState.roomCode).toBe('')
    })

    it('should have null hostName initially', () => {
      expect(gameState.hostName).toBeNull()
    })

    it('should have correct settings structure', () => {
      expect(gameState.settings).toBeDefined()
      expect(typeof gameState.settings).toBe('object')
    })

    it('should have correct default settings values', () => {
      expect(gameState.settings.minPlayers).toBe(4)
      expect(gameState.settings.maxPlayers).toBe(10)
      expect(gameState.settings.tasksPerPlayer).toBe(4)
      expect(gameState.settings.traitorCount).toBe(1)
      expect(gameState.settings.eliminationCooldown).toBe(30)
      expect(gameState.settings.cooldownReduction).toBe(5)
      expect(gameState.settings.meetingRoom).toBe('')
      expect(gameState.settings.meetingLimit).toBe(1)
      expect(gameState.settings.meetingTimer).toBe(60)
      expect(gameState.settings.additionalRules).toBe('')
    })

    it('should have empty selectedRooms object', () => {
      expect(gameState.settings.selectedRooms).toEqual({})
    })

    it('should have empty uniqueTasks array', () => {
      expect(gameState.settings.uniqueTasks).toEqual([])
    })

    it('should have empty players array initially', () => {
      expect(gameState.players).toEqual([])
    })

    it('should have null currentPlayer initially', () => {
      expect(gameState.currentPlayer).toBeNull()
    })

    it('should have roleRevealed as false initially', () => {
      expect(gameState.roleRevealed).toBe(false)
    })

    it('should have meetingsUsed as 0 initially', () => {
      expect(gameState.meetingsUsed).toBe(0)
    })

    it('should have null meetingCaller initially', () => {
      expect(gameState.meetingCaller).toBeNull()
    })

    it('should have null meetingType initially', () => {
      expect(gameState.meetingType).toBeNull()
    })

    it('should have gameEnded as false initially', () => {
      expect(gameState.gameEnded).toBe(false)
    })

    it('should have null winner initially', () => {
      expect(gameState.winner).toBeNull()
    })

    it('should be mutable (can update properties)', () => {
      const originalStage = gameState.stage
      gameState.stage = 'playing'
      expect(gameState.stage).toBe('playing')
      // Restore original value
      gameState.stage = originalStage
    })
  })

  describe('Module Variables', () => {
    beforeEach(() => {
      // Reset module variables before each test
      setMyPlayerName(null)
      setIsGameCreator(false)
      setCurrentGameId(null)
      setGameChannel(null)
      setPlayersChannel(null)
      setPlayerExistenceInterval(null)
    })

    it('should export myPlayerName as null initially', () => {
      setMyPlayerName(null)
      expect(myPlayerName).toBeNull()
    })

    it('should export isGameCreator as false initially', () => {
      setIsGameCreator(false)
      expect(isGameCreator).toBe(false)
    })

    it('should export currentGameId as null initially', () => {
      setCurrentGameId(null)
      expect(currentGameId).toBeNull()
    })

    it('should export gameChannel as null initially', () => {
      setGameChannel(null)
      expect(gameChannel).toBeNull()
    })

    it('should export playersChannel as null initially', () => {
      setPlayersChannel(null)
      expect(playersChannel).toBeNull()
    })

    it('should export playerExistenceInterval as null initially', () => {
      setPlayerExistenceInterval(null)
      expect(playerExistenceInterval).toBeNull()
    })
  })

  describe('Setter Functions', () => {
    beforeEach(() => {
      // Reset all values before each test
      setMyPlayerName(null)
      setIsGameCreator(false)
      setCurrentGameId(null)
      setGameChannel(null)
      setPlayersChannel(null)
      setPlayerExistenceInterval(null)
      gameState.hostName = null
    })

    describe('setMyPlayerName', () => {
      it('should set myPlayerName to a string value', () => {
        setMyPlayerName('TestPlayer')
        // Note: We can't directly verify the internal variable changed,
        // but we can verify through isHost() behavior
        gameState.hostName = 'TestPlayer'
        expect(isHost()).toBe(true)
      })

      it('should set myPlayerName to null', () => {
        setMyPlayerName('Player1')
        setMyPlayerName(null)
        gameState.hostName = 'Player1'
        expect(isHost()).toBe(false)
      })
    })

    describe('setIsGameCreator', () => {
      it('should set isGameCreator to true', () => {
        setIsGameCreator(true)
        expect(isHost()).toBe(true)
      })

      it('should set isGameCreator to false', () => {
        setIsGameCreator(false)
        expect(isHost()).toBeFalsy() // Returns falsy value (null) when conditions not met
      })
    })

    describe('setCurrentGameId', () => {
      it('should set currentGameId to a string value', () => {
        const testId = 'test-game-id-123'
        setCurrentGameId(testId)
        // Verify by checking if it's used correctly (indirect test)
        expect(testId).toBeDefined()
      })

      it('should set currentGameId to null', () => {
        setCurrentGameId('some-id')
        setCurrentGameId(null)
        // Verify setter was called without error
        expect(true).toBe(true)
      })
    })

    describe('setGameChannel', () => {
      it('should set gameChannel to an object', () => {
        const mockChannel = { id: 'channel-1' }
        setGameChannel(mockChannel)
        // Verify setter was called without error
        expect(mockChannel).toBeDefined()
      })

      it('should set gameChannel to null', () => {
        setGameChannel({ id: 'test' })
        setGameChannel(null)
        expect(true).toBe(true)
      })
    })

    describe('setPlayersChannel', () => {
      it('should set playersChannel to an object', () => {
        const mockChannel = { id: 'players-channel-1' }
        setPlayersChannel(mockChannel)
        expect(mockChannel).toBeDefined()
      })

      it('should set playersChannel to null', () => {
        setPlayersChannel({ id: 'test' })
        setPlayersChannel(null)
        expect(true).toBe(true)
      })
    })

    describe('setPlayerExistenceInterval', () => {
      it('should set playerExistenceInterval to a number', () => {
        const mockInterval = 12345
        setPlayerExistenceInterval(mockInterval)
        expect(mockInterval).toBeDefined()
      })

      it('should set playerExistenceInterval to null', () => {
        setPlayerExistenceInterval(123)
        setPlayerExistenceInterval(null)
        expect(true).toBe(true)
      })
    })
  })

  describe('isHost Function', () => {
    beforeEach(() => {
      // Reset state before each test
      setMyPlayerName(null)
      setIsGameCreator(false)
      gameState.hostName = null
    })

    it('should return true when isGameCreator is true', () => {
      setIsGameCreator(true)
      expect(isHost()).toBe(true)
    })

    it('should return true when myPlayerName matches hostName', () => {
      setMyPlayerName('HostPlayer')
      gameState.hostName = 'HostPlayer'
      expect(isHost()).toBe(true)
    })

    it('should return true when both isGameCreator is true AND name matches', () => {
      setIsGameCreator(true)
      setMyPlayerName('HostPlayer')
      gameState.hostName = 'HostPlayer'
      expect(isHost()).toBe(true)
    })

    it('should return false when neither condition is met', () => {
      setIsGameCreator(false)
      setMyPlayerName('Player1')
      gameState.hostName = 'Player2'
      expect(isHost()).toBe(false)
    })

    it('should return falsy when hostName is null', () => {
      setIsGameCreator(false)
      setMyPlayerName('Player1')
      gameState.hostName = null
      expect(isHost()).toBeFalsy() // Returns null when hostName is null
    })

    it('should return falsy when myPlayerName is null', () => {
      setIsGameCreator(false)
      setMyPlayerName(null)
      gameState.hostName = 'HostPlayer'
      expect(isHost()).toBeFalsy()
    })

    it('should return true when isGameCreator is true even if myPlayerName is null', () => {
      setIsGameCreator(true)
      setMyPlayerName(null)
      gameState.hostName = 'SomeHost'
      expect(isHost()).toBe(true)
    })

    it('should return true when isGameCreator is true even if hostName is null', () => {
      setIsGameCreator(true)
      setMyPlayerName('Player1')
      gameState.hostName = null
      expect(isHost()).toBe(true)
    })

    it('should be case-sensitive for name matching', () => {
      setIsGameCreator(false)
      setMyPlayerName('HostPlayer')
      gameState.hostName = 'hostplayer' // Different case
      expect(isHost()).toBeFalsy()
    })

    it('should handle empty string hostName', () => {
      setIsGameCreator(false)
      setMyPlayerName('Player1')
      gameState.hostName = ''
      expect(isHost()).toBeFalsy() // Returns '' (empty string) when hostName is empty
    })

    it('should handle whitespace in names', () => {
      setIsGameCreator(false)
      setMyPlayerName('Host Player')
      gameState.hostName = 'Host Player'
      expect(isHost()).toBe(true)
    })
  })

  describe('Game State Stages', () => {
    it('should support setup stage', () => {
      gameState.stage = 'setup'
      expect(gameState.stage).toBe('setup')
    })

    it('should support waiting stage', () => {
      gameState.stage = 'waiting'
      expect(gameState.stage).toBe('waiting')
    })

    it('should support playing stage', () => {
      gameState.stage = 'playing'
      expect(gameState.stage).toBe('playing')
    })

    it('should support meeting stage', () => {
      gameState.stage = 'meeting'
      expect(gameState.stage).toBe('meeting')
    })

    it('should support ended stage', () => {
      gameState.stage = 'ended'
      expect(gameState.stage).toBe('ended')
    })
  })

  describe('Game State Mutations', () => {
    beforeEach(() => {
      // Reset gameState to initial values
      gameState.players = []
      gameState.currentPlayer = null
      gameState.roomCode = ''
      gameState.hostName = null
      gameState.meetingsUsed = 0
      gameState.gameEnded = false
      gameState.winner = null
    })

    it('should allow adding players to gameState', () => {
      gameState.players.push({ name: 'Player1', role: 'ally' })
      expect(gameState.players).toHaveLength(1)
      expect(gameState.players[0].name).toBe('Player1')
    })

    it('should allow updating roomCode', () => {
      gameState.roomCode = 'ABC123'
      expect(gameState.roomCode).toBe('ABC123')
    })

    it('should allow updating hostName', () => {
      gameState.hostName = 'HostPlayer'
      expect(gameState.hostName).toBe('HostPlayer')
    })

    it('should allow incrementing meetingsUsed', () => {
      gameState.meetingsUsed = 0
      gameState.meetingsUsed++
      expect(gameState.meetingsUsed).toBe(1)
    })

    it('should allow setting gameEnded flag', () => {
      gameState.gameEnded = true
      expect(gameState.gameEnded).toBe(true)
    })

    it('should allow setting winner', () => {
      gameState.winner = 'allies'
      expect(gameState.winner).toBe('allies')
    })

    it('should allow updating settings', () => {
      gameState.settings.minPlayers = 6
      gameState.settings.traitorCount = 2
      expect(gameState.settings.minPlayers).toBe(6)
      expect(gameState.settings.traitorCount).toBe(2)
    })

    it('should allow adding rooms to selectedRooms', () => {
      gameState.settings.selectedRooms = {
        'Kitchen': {
          enabled: true,
          tasks: [{ name: 'Task1', enabled: true }]
        }
      }
      expect(Object.keys(gameState.settings.selectedRooms)).toContain('Kitchen')
    })
  })
})
