import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateRoomCode,
  getGameURL,
  generateQRCode,
  createGame,
  checkWinConditions,
  checkCrewmateVictory,
  endGame
} from '../js/game-logic.js'
import { gameState } from '../js/game-state.js'

// Mock endGame to prevent DOM access
vi.mock('../js/game-logic.js', async () => {
  const actual = await vi.importActual('../js/game-logic.js')
  return {
    ...actual,
    endGame: vi.fn()
  }
})

describe('Room Code Generation', () => {
  it('should generate a 4-character alphanumeric code', () => {
    const code = generateRoomCode()

    expect(code).toBeDefined()
    expect(code).toHaveLength(4)
    // Code contains letters (excluding I, O) and numbers (excluding 0, 1)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/)
  })

  it('should generate unique codes', () => {
    const codes = new Set()
    for (let i = 0; i < 100; i++) {
      codes.add(generateRoomCode())
    }

    // With 32^4 = 1,048,576 possible codes, 100 codes should be unique
    expect(codes.size).toBe(100)
  })
})

describe('Game URL Generation', () => {
  beforeEach(() => {
    // Mock window.location for URL generation
    global.window = {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/'
      }
    }
  })

  it('should generate URL with room code from gameState', () => {
    gameState.roomCode = 'TEST'
    const url = getGameURL()

    expect(url).toContain('TEST')
    expect(url).toMatch(/\?room=TEST$/)
  })
})

describe('QR Code Generation', () => {
  let mockQRCodeImage

  beforeEach(() => {
    // Mock window.location for URL generation
    global.window = {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/'
      }
    }

    // Create mock QR code image element
    mockQRCodeImage = {
      src: '',
      setAttribute: vi.fn(),
      getAttribute: vi.fn()
    }

    // Mock document.getElementById to return our mock image element
    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'qr-code-image') {
          return mockQRCodeImage
        }
        return null
      }),
      body: {
        innerHTML: ''
      }
    }

    // Set a test room code
    gameState.roomCode = 'ABC123'
  })

  it('should generate QR code with correct API URL', () => {
    generateQRCode()

    // Verify QR code image src was set
    expect(mockQRCodeImage.src).toBeDefined()
    expect(mockQRCodeImage.src).toContain('https://api.qrserver.com/v1/create-qr-code/')
  })

  it('should include correct size parameter in QR code URL', () => {
    generateQRCode()

    expect(mockQRCodeImage.src).toContain('size=180x180')
  })

  it('should encode game URL in QR code data parameter', () => {
    generateQRCode()

    const expectedGameUrl = 'http://localhost:3000/?room=ABC123'
    const encodedUrl = encodeURIComponent(expectedGameUrl)

    expect(mockQRCodeImage.src).toContain(`data=${encodedUrl}`)
  })

  it('should update QR code when room code changes', () => {
    // Generate QR code with first room code
    gameState.roomCode = 'FIRST'
    generateQRCode()
    const firstQRUrl = mockQRCodeImage.src

    // Change room code and regenerate
    gameState.roomCode = 'SECOND'
    generateQRCode()
    const secondQRUrl = mockQRCodeImage.src

    // URLs should be different
    expect(firstQRUrl).not.toBe(secondQRUrl)
    expect(secondQRUrl).toContain('SECOND')
    expect(secondQRUrl).not.toContain('FIRST')
  })

  it('should construct complete QR API URL with all parameters', () => {
    generateQRCode()

    const qrUrl = mockQRCodeImage.src
    const expectedGameUrl = encodeURIComponent('http://localhost:3000/?room=ABC123')

    expect(qrUrl).toBe(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${expectedGameUrl}`)
  })

  it('should call getElementById with correct ID', () => {
    generateQRCode()

    expect(global.document.getElementById).toHaveBeenCalledWith('qr-code-image')
  })
})

describe('QR Code Integration with Game Sessions', () => {
  let mockElements

  beforeEach(() => {
    // Mock window.location
    global.window = {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/'
      }
    }

    // Create comprehensive mock elements for createGame
    mockElements = {
      qrCodeImage: { src: '' },
      minPlayers: { value: '4' },
      maxPlayers: { value: '10' },
      tasksPerPlayer: { value: '3' },
      imposterCount: { value: '2' },
      eliminationCooldown: { value: '30' },
      cooldownReduction: { value: '5' },
      meetingRoom: { value: 'Living Room' },
      meetingLimit: { value: '3' },
      meetingTimer: { value: '60' },
      additionalRules: { value: '' },
      minPlayersDisplay: { textContent: '' },
      maxPlayersDisplay: { textContent: '' },
      imposterCountDisplay: { textContent: '' },
      setupPhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      waitingRoom: { classList: { add: vi.fn(), remove: vi.fn() } },
      roomCode: { textContent: '' },
      joinForm: { classList: { add: vi.fn(), remove: vi.fn() } },
      alreadyJoined: { classList: { add: vi.fn(), remove: vi.fn() } }
    }

    // Mock document.getElementById
    global.document = {
      getElementById: vi.fn((id) => {
        const elementMap = {
          'qr-code-image': mockElements.qrCodeImage,
          'min-players': mockElements.minPlayers,
          'max-players': mockElements.maxPlayers,
          'tasks-per-player': mockElements.tasksPerPlayer,
          'imposter-count': mockElements.imposterCount,
          'elimination-cooldown': mockElements.eliminationCooldown,
          'cooldown-reduction': mockElements.cooldownReduction,
          'meeting-room': mockElements.meetingRoom,
          'meeting-limit': mockElements.meetingLimit,
          'meeting-timer': mockElements.meetingTimer,
          'additional-rules': mockElements.additionalRules,
          'min-players-display': mockElements.minPlayersDisplay,
          'max-players-display': mockElements.maxPlayersDisplay,
          'imposter-count-display': mockElements.imposterCountDisplay,
          'setup-phase': mockElements.setupPhase,
          'waiting-room': mockElements.waitingRoom,
          'room-code': mockElements.roomCode,
          'join-form': mockElements.joinForm,
          'already-joined': mockElements.alreadyJoined
        }
        return elementMap[id] || null
      }),
      body: {
        innerHTML: ''
      }
    }

    // Reset gameState
    gameState.roomCode = ''
    gameState.stage = 'setup'
  })

  it('should generate QR code when createGame is called', async () => {
    await createGame()

    // Verify QR code was generated
    expect(mockElements.qrCodeImage.src).toBeDefined()
    expect(mockElements.qrCodeImage.src).toContain('https://api.qrserver.com/v1/create-qr-code/')
  })

  it('should generate QR code with new room code after createGame', async () => {
    await createGame()

    const qrUrl = mockElements.qrCodeImage.src
    const roomCode = mockElements.roomCode.textContent

    // Room code should be set
    expect(roomCode).toHaveLength(4)
    expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{4}$/)

    // QR code should contain the room code
    expect(qrUrl).toContain(encodeURIComponent(roomCode))
  })

  it('should update gameState.roomCode before generating QR code', async () => {
    await createGame()

    // Room code should be set in gameState
    expect(gameState.roomCode).toBeDefined()
    expect(gameState.roomCode).toHaveLength(4)

    // QR code should use the gameState room code
    const expectedUrl = encodeURIComponent(`http://localhost:3000/?room=${gameState.roomCode}`)
    expect(mockElements.qrCodeImage.src).toContain(expectedUrl)
  })
})

describe('Win Condition Checks', () => {
  beforeEach(() => {
    // Reset gameState before each test
    gameState.players = []
    gameState.gameEnded = false
    gameState.winner = null
  })

  describe('checkWinConditions', () => {
    it('should return crewmates win when all imposters are eliminated', () => {
      gameState.players = [
        { name: 'Player1', role: 'crewmate', alive: true },
        { name: 'Player2', role: 'crewmate', alive: true },
        { name: 'Imposter1', role: 'imposter', alive: false }
      ]

      const result = checkWinConditions()

      expect(result).toBeDefined()
      expect(result.winner).toBe('crewmates')
      expect(result.reason).toBe('All imposters eliminated')
    })

    it('should return imposters win when they equal crewmates', () => {
      gameState.players = [
        { name: 'Player1', role: 'crewmate', alive: true },
        { name: 'Player2', role: 'crewmate', alive: false },
        { name: 'Imposter1', role: 'imposter', alive: true }
      ]

      const result = checkWinConditions()

      expect(result).toBeDefined()
      expect(result.winner).toBe('imposters')
      expect(result.reason).toBe('Imposters equal or outnumber crewmates')
    })

    it('should return null when game is still in progress', () => {
      gameState.players = [
        { name: 'Player1', role: 'crewmate', alive: true },
        { name: 'Player2', role: 'crewmate', alive: true },
        { name: 'Imposter1', role: 'imposter', alive: true }
      ]

      const result = checkWinConditions()

      expect(result).toBeNull()
    })

    it('should handle undefined alive status by defaulting to true', () => {
      gameState.players = [
        { name: 'Player1', role: 'crewmate', alive: undefined },
        { name: 'Player2', role: 'crewmate', alive: null },
        { name: 'Imposter1', role: 'imposter', alive: false }
      ]

      const result = checkWinConditions()

      // Should set alive to true for undefined/null
      expect(gameState.players[0].alive).toBe(true)
      expect(gameState.players[1].alive).toBe(true)

      // Crewmates should win since imposter is dead
      expect(result.winner).toBe('crewmates')
    })

    it('should throw error if no imposters existed (game malfunction)', () => {
      gameState.players = [
        { name: 'Player1', role: 'crewmate', alive: true },
        { name: 'Player2', role: 'crewmate', alive: true }
      ]

      expect(() => checkWinConditions()).toThrow('Game malfunction: No imposters were assigned at game start')
    })
  })

  describe('checkCrewmateVictory', () => {
    beforeEach(() => {
      // Clear mock calls
      vi.clearAllMocks()
    })

    it('should not call endGame when tasks are incomplete', () => {
      gameState.players = [
        {
          name: 'Player1',
          role: 'crewmate',
          alive: true,
          tasks: ['Task1', 'Task2'],
          tasksCompleted: 1
        },
        {
          name: 'Player2',
          role: 'crewmate',
          alive: true,
          tasks: ['Task3', 'Task4'],
          tasksCompleted: 1
        }
      ]

      checkCrewmateVictory()

      // Should not call endGame when tasks incomplete
      expect(endGame).not.toHaveBeenCalled()
    })

    it('should end game when all tasks are complete', () => {
      // Mock DOM elements that endGame and populateGameSummary try to access
      const mockElement = {
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        innerHTML: '',
        textContent: '',
        style: {},
        appendChild: vi.fn()
      }

      // Store original document
      const originalDocument = global.document

      // Mock document.getElementById while keeping document.body
      global.document = {
        ...originalDocument,
        getElementById: vi.fn(() => mockElement),
        body: originalDocument?.body || { innerHTML: '' },
        createElement: vi.fn(() => mockElement)
      }

      gameState.players = [
        {
          name: 'Player1',
          role: 'crewmate',
          alive: true,
          tasks: ['Task1', 'Task2'],
          tasksCompleted: 2
        },
        {
          name: 'Player2',
          role: 'crewmate',
          alive: true,
          tasks: ['Task3', 'Task4'],
          tasksCompleted: 2
        },
        {
          name: 'Player3',
          role: 'crewmate',
          alive: false, // Eliminated player
          tasks: ['Task5', 'Task6'],
          tasksCompleted: 2 // All tasks complete
        },
        {
          name: 'Imposter1',
          role: 'imposter',
          alive: true,
          tasks: [],
          tasksCompleted: 0
        }
      ]

      checkCrewmateVictory()

      // Restore original document
      global.document = originalDocument

      // Verify game ended with crewmates winning
      // All 6 crewmate tasks complete (including eliminated player's tasks)
      expect(gameState.gameEnded).toBe(true)
      expect(gameState.winner).toBe('crewmates')
      expect(gameState.stage).toBe('ended')
    })

    it('should count ALL crewmates tasks (including eliminated players)', () => {
      gameState.players = [
        {
          name: 'Player1',
          role: 'crewmate',
          alive: true,
          tasks: ['Task1', 'Task2', 'Task3'],
          tasksCompleted: 2 // Not all tasks complete
        },
        {
          name: 'Player2',
          role: 'crewmate',
          alive: false, // Eliminated player
          tasks: ['Task4', 'Task5'],
          tasksCompleted: 0 // Incomplete tasks
        },
        {
          name: 'Imposter1',
          role: 'imposter',
          alive: true,
          tasks: [],
          tasksCompleted: 0
        }
      ]

      checkCrewmateVictory()

      // Should not end game - only 2/5 total crewmate tasks complete
      // Both alive AND eliminated crewmates' tasks count toward total
      expect(endGame).not.toHaveBeenCalled()
    })

    it('should handle crewmates with no tasks', () => {
      gameState.players = [
        {
          name: 'Player1',
          role: 'crewmate',
          alive: true,
          tasks: [],
          tasksCompleted: 0
        }
      ]

      checkCrewmateVictory()

      // Should not throw with empty task list
      expect(endGame).not.toHaveBeenCalled()
    })
  })
})

// TODO: Add more test suites for:
// - Player management (join, leave, kick)
// - Game state transitions
// - Voting logic
// - Task toggling
// - New session creation (newGameSameSettings, newGameNewSettings)
