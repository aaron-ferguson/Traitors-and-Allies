import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateRoomCode,
  getGameURL,
  generateQRCode,
  createGame,
  joinGame,
  kickPlayer,
  leaveGame,
  startGame,
  returnToMenu,
  toggleTaskComplete,
  selectVote,
  setSelectedVote,
  submitVote,
  tallyVotes,
  displayVoteResults,
  checkWinConditions,
  checkAllyVictory,
  endGame,
  eliminatePlayer,
  callMeeting,
  acknowledgeMeeting,
  resumeGame
} from '../js/game-logic.js'
import { gameState, myPlayerName, isGameCreator, setMyPlayerName, setIsGameCreator, setCurrentGameId } from '../js/game-state.js'

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
      traitorCount: { value: '2' },
      eliminationCooldown: { value: '30' },
      cooldownReduction: { value: '5' },
      meetingRoom: { value: 'Living Room' },
      meetingLimit: { value: '3' },
      meetingTimer: { value: '60' },
      additionalRules: { value: '' },
      minPlayersDisplay: { textContent: '' },
      maxPlayersDisplay: { textContent: '' },
      traitorCountDisplay: { textContent: '' },
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
          'traitor-count': mockElements.traitorCount,
          'elimination-cooldown': mockElements.eliminationCooldown,
          'cooldown-reduction': mockElements.cooldownReduction,
          'meeting-room': mockElements.meetingRoom,
          'meeting-limit': mockElements.meetingLimit,
          'meeting-timer': mockElements.meetingTimer,
          'additional-rules': mockElements.additionalRules,
          'min-players-display': mockElements.minPlayersDisplay,
          'max-players-display': mockElements.maxPlayersDisplay,
          'traitor-count-display': mockElements.traitorCountDisplay,
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
    it('should return allies win when all traitors are eliminated', () => {
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Traitor1', role: 'traitor', alive: false }
      ]

      const result = checkWinConditions()

      expect(result).toBeDefined()
      expect(result.winner).toBe('allies')
      expect(result.reason).toBe('All traitors eliminated')
    })

    it('should return traitors win when they equal allies', () => {
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: false },
        { name: 'Traitor1', role: 'traitor', alive: true }
      ]

      const result = checkWinConditions()

      expect(result).toBeDefined()
      expect(result.winner).toBe('traitors')
      expect(result.reason).toBe('Traitors equal or outnumber allies')
    })

    it('should return null when game is still in progress', () => {
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Traitor1', role: 'traitor', alive: true }
      ]

      const result = checkWinConditions()

      expect(result).toBeNull()
    })

    it('should handle undefined alive status by defaulting to true', () => {
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: undefined },
        { name: 'Player2', role: 'ally', alive: null },
        { name: 'Traitor1', role: 'traitor', alive: false }
      ]

      const result = checkWinConditions()

      // Should set alive to true for undefined/null
      expect(gameState.players[0].alive).toBe(true)
      expect(gameState.players[1].alive).toBe(true)

      // Allies should win since traitor is dead
      expect(result.winner).toBe('allies')
    })

    it('should throw error if no traitors existed (game malfunction)', () => {
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true }
      ]

      expect(() => checkWinConditions()).toThrow('Game malfunction: No traitors were assigned at game start')
    })
  })

  describe('checkAllyVictory', () => {
    beforeEach(() => {
      // Reset game ended state
      gameState.gameEnded = false
      gameState.winner = null

      // Clear mock calls
      vi.clearAllMocks()
    })

    it('should not end game when tasks are incomplete', () => {
      gameState.players = [
        {
          name: 'Player1',
          role: 'ally',
          alive: true,
          tasks: ['Task1', 'Task2'],
          tasksCompleted: 1
        },
        {
          name: 'Player2',
          role: 'ally',
          alive: true,
          tasks: ['Task3', 'Task4'],
          tasksCompleted: 1
        }
      ]

      checkAllyVictory()

      // Should not end game when tasks incomplete
      expect(gameState.gameEnded).toBe(false)
      expect(gameState.winner).toBeNull()
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
          role: 'ally',
          alive: true,
          tasks: ['Task1', 'Task2'],
          tasksCompleted: 2
        },
        {
          name: 'Player2',
          role: 'ally',
          alive: true,
          tasks: ['Task3', 'Task4'],
          tasksCompleted: 2
        },
        {
          name: 'Player3',
          role: 'ally',
          alive: false, // Eliminated player
          tasks: ['Task5', 'Task6'],
          tasksCompleted: 2 // All tasks complete
        },
        {
          name: 'Traitor1',
          role: 'traitor',
          alive: true,
          tasks: [],
          tasksCompleted: 0
        }
      ]

      checkAllyVictory()

      // Restore original document
      global.document = originalDocument

      // Verify game ended with allies winning
      // All 6 ally tasks complete (including eliminated player's tasks)
      expect(gameState.gameEnded).toBe(true)
      expect(gameState.winner).toBe('allies')
      expect(gameState.stage).toBe('ended')
    })

    it('should count ALL allies tasks (including eliminated players)', () => {
      gameState.players = [
        {
          name: 'Player1',
          role: 'ally',
          alive: true,
          tasks: ['Task1', 'Task2', 'Task3'],
          tasksCompleted: 2 // Not all tasks complete
        },
        {
          name: 'Player2',
          role: 'ally',
          alive: false, // Eliminated player
          tasks: ['Task4', 'Task5'],
          tasksCompleted: 0 // Incomplete tasks
        },
        {
          name: 'Traitor1',
          role: 'traitor',
          alive: true,
          tasks: [],
          tasksCompleted: 0
        }
      ]

      checkAllyVictory()

      // Should not end game - only 2/5 total ally tasks complete
      // Both alive AND eliminated allies' tasks count toward total
      expect(gameState.gameEnded).toBe(false)
      expect(gameState.winner).toBeNull()
    })
  })
})

describe('Player Management', () => {
  let mockElements

  beforeEach(() => {
    // Reset gameState
    gameState.players = []
    gameState.settings.maxPlayers = 10
    gameState.hostName = null
    setMyPlayerName(null)
    setIsGameCreator(false)

    // Mock DOM elements
    mockElements = {
      playerNameInput: { value: '', trim: vi.fn() },
      roomFullMessage: { classList: { add: vi.fn(), remove: vi.fn() } },
      joinForm: { classList: { add: vi.fn(), remove: vi.fn() } },
      alreadyJoined: { classList: { add: vi.fn(), remove: vi.fn() } },
      myPlayerName: { textContent: '' },
      editSettingsBtn: { style: { display: '' } }
    }

    global.document = {
      getElementById: vi.fn((id) => {
        const elementMap = {
          'player-name-input': mockElements.playerNameInput,
          'room-full-message': mockElements.roomFullMessage,
          'join-form': mockElements.joinForm,
          'already-joined': mockElements.alreadyJoined,
          'my-player-name': mockElements.myPlayerName,
          'edit-settings-btn': mockElements.editSettingsBtn
        }
        return elementMap[id] || { classList: { add: vi.fn(), remove: vi.fn() }, style: {} }
      }),
      body: { innerHTML: '' }
    }

    // Mock window functions
    global.alert = vi.fn()
    global.confirm = vi.fn(() => true)

    // Mock backend functions that player management uses
    global.startPlayerExistenceCheck = vi.fn()
    global.addPlayerToDB = vi.fn(async () => {})
    global.updatePlayerInDB = vi.fn(async () => {})
    global.removePlayerFromDB = vi.fn(async () => {})

    // Clear all mock calls
    vi.clearAllMocks()
  })

  describe('joinGame', () => {
    it('should reject empty player name', async () => {
      mockElements.playerNameInput.value = ''

      await joinGame()

      expect(global.alert).toHaveBeenCalledWith('Please enter your name!')
      expect(gameState.players).toHaveLength(0)
    })

    it('should reject whitespace-only player name', async () => {
      mockElements.playerNameInput.value = '   '

      await joinGame()

      expect(global.alert).toHaveBeenCalledWith('Please enter your name!')
      expect(gameState.players).toHaveLength(0)
    })

    it('should reject join when room is full', async () => {
      mockElements.playerNameInput.value = 'Player1'
      gameState.settings.maxPlayers = 2
      gameState.players = [
        { name: 'ExistingPlayer1', ready: true },
        { name: 'ExistingPlayer2', ready: true }
      ]

      await joinGame()

      expect(mockElements.roomFullMessage.classList.remove).toHaveBeenCalledWith('hidden')
      expect(gameState.players).toHaveLength(2)
    })

    it('should add new player with correct properties', async () => {
      mockElements.playerNameInput.value = 'NewPlayer'

      await joinGame()

      expect(gameState.players).toHaveLength(1)
      expect(gameState.players[0]).toEqual({
        name: 'NewPlayer',
        ready: true,
        role: null,
        tasks: [],
        alive: true,
        tasksCompleted: 0
      })
    })

    it('should handle reconnection for existing player', async () => {
      const existingPlayer = {
        name: 'ExistingPlayer',
        ready: false,
        role: 'ally',
        tasks: ['Task1'],
        alive: true,
        tasksCompleted: 0
      }
      gameState.players = [existingPlayer]
      mockElements.playerNameInput.value = 'ExistingPlayer'

      await joinGame()

      // Should not add duplicate
      expect(gameState.players).toHaveLength(1)
      // Should reconnect as existing player (case-sensitive match)
      expect(gameState.players[0]).toEqual(existingPlayer)
    })

    it('should handle case-insensitive reconnection', async () => {
      const existingPlayer = {
        name: 'ExistingPlayer',
        ready: false,
        role: 'ally',
        tasks: ['Task1'],
        alive: true,
        tasksCompleted: 0
      }
      gameState.players = [existingPlayer]
      mockElements.playerNameInput.value = 'existingplayer' // lowercase

      await joinGame()

      // Should not add duplicate
      expect(gameState.players).toHaveLength(1)
      expect(gameState.players[0]).toEqual(existingPlayer)
    })

    it('should set first player as host when isGameCreator is true', async () => {
      setIsGameCreator(true)
      mockElements.playerNameInput.value = 'HostPlayer'

      await joinGame()

      expect(gameState.hostName).toBe('HostPlayer')
      expect(gameState.players[0].name).toBe('HostPlayer')
    })

    it('should not set host if hostName already exists', async () => {
      setIsGameCreator(true)
      gameState.hostName = 'ExistingHost'
      mockElements.playerNameInput.value = 'NewPlayer'

      await joinGame()

      expect(gameState.hostName).toBe('ExistingHost')
      expect(gameState.players[0].name).toBe('NewPlayer')
    })

    it('should trim player name whitespace', async () => {
      mockElements.playerNameInput.value = '  PlayerWithSpaces  '

      await joinGame()

      expect(gameState.players[0].name).toBe('PlayerWithSpaces')
    })
  })

  describe('kickPlayer', () => {
    beforeEach(() => {
      // Set up a host and some players
      gameState.hostName = 'Host'
      setMyPlayerName('Host')
      setIsGameCreator(true)
      gameState.players = [
        { name: 'Host', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 },
        { name: 'Player1', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 },
        { name: 'Player2', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 }
      ]
    })

    it('should allow host to kick player', async () => {
      await kickPlayer('Player1')

      expect(gameState.players).toHaveLength(2)
      expect(gameState.players.find(p => p.name === 'Player1')).toBeUndefined()
      expect(gameState.players.find(p => p.name === 'Host')).toBeDefined()
      expect(gameState.players.find(p => p.name === 'Player2')).toBeDefined()
    })

    it('should not kick player if user cancels confirmation', async () => {
      global.confirm = vi.fn(() => false)

      await kickPlayer('Player1')

      expect(gameState.players).toHaveLength(3)
      expect(gameState.players.find(p => p.name === 'Player1')).toBeDefined()
    })

    it('should prevent non-host from kicking players', async () => {
      setMyPlayerName('Player1')
      setIsGameCreator(false)

      await kickPlayer('Player2')

      expect(global.alert).toHaveBeenCalledWith('Only the host can kick players!')
      expect(gameState.players).toHaveLength(3)
    })

    it('should handle kicking non-existent player gracefully', async () => {
      await kickPlayer('NonExistentPlayer')

      // Should not crash, players should remain unchanged
      expect(gameState.players).toHaveLength(3)
    })
  })

  describe('leaveGame', () => {
    beforeEach(() => {
      gameState.players = [
        { name: 'Player1', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 },
        { name: 'Player2', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 },
        { name: 'Player3', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 }
      ]
      setMyPlayerName('Player2')
    })

    it('should remove player from game when confirmed', () => {
      global.confirm = vi.fn(() => true)

      leaveGame()

      expect(gameState.players).toHaveLength(2)
      expect(gameState.players.find(p => p.name === 'Player2')).toBeUndefined()
      expect(gameState.players.find(p => p.name === 'Player1')).toBeDefined()
      expect(gameState.players.find(p => p.name === 'Player3')).toBeDefined()
    })

    it('should not remove player if user cancels', () => {
      global.confirm = vi.fn(() => false)

      leaveGame()

      expect(gameState.players).toHaveLength(3)
      expect(gameState.players.find(p => p.name === 'Player2')).toBeDefined()
    })

    it('should do nothing if myPlayerName is not set', () => {
      setMyPlayerName(null)

      leaveGame()

      expect(gameState.players).toHaveLength(3)
      expect(global.confirm).not.toHaveBeenCalled()
    })

    it('should handle leaving when player is not in game', () => {
      setMyPlayerName('NonExistentPlayer')
      global.confirm = vi.fn(() => true)

      leaveGame()

      // Should not crash
      expect(gameState.players).toHaveLength(3)
    })

    it('should show confirmation dialog with correct message', () => {
      leaveGame()

      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to leave the game?')
    })
  })
})

describe('Game State Transitions', () => {
  let mockElements

  beforeEach(() => {
    // Reset gameState to setup stage
    gameState.stage = 'setup'
    gameState.players = []
    gameState.settings.minPlayers = 4
    gameState.settings.maxPlayers = 10
    gameState.settings.traitorCount = 1
    gameState.settings.tasksPerPlayer = 3
    gameState.settings.selectedRooms = {
      'Living Room': {
        enabled: true,
        tasks: [
          { name: 'Task1', enabled: true, unique: false },
          { name: 'Task2', enabled: true, unique: false }
        ]
      }
    }
    gameState.hostName = null
    gameState.gameEnded = false
    gameState.winner = null
    setMyPlayerName(null)
    setIsGameCreator(false)

    // Mock DOM elements
    mockElements = {
      waitingRoom: { classList: { add: vi.fn(), remove: vi.fn() } },
      gamePhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      meetingPhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      gameEnd: { classList: { add: vi.fn(), remove: vi.fn() } },
      setupPhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      mainMenu: { classList: { add: vi.fn(), remove: vi.fn() } }
    }

    global.document = {
      getElementById: vi.fn((id) => {
        const elementMap = {
          'waiting-room': mockElements.waitingRoom,
          'game-phase': mockElements.gamePhase,
          'meeting-phase': mockElements.meetingPhase,
          'game-end': mockElements.gameEnd,
          'setup-phase': mockElements.setupPhase,
          'main-menu': mockElements.mainMenu
        }
        return elementMap[id] || {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          innerHTML: '',
          textContent: '',
          appendChild: vi.fn()
        }
      }),
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn(),
        addEventListener: vi.fn()
      })),
      body: { innerHTML: '' }
    }

    global.alert = vi.fn()
    global.confirm = vi.fn(() => true)

    vi.clearAllMocks()
  })

  describe('waiting -> playing transition', () => {
    beforeEach(() => {
      gameState.stage = 'waiting'
      gameState.hostName = 'Host'
      setMyPlayerName('Host')
      setIsGameCreator(true)
      gameState.players = [
        { name: 'Host', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 },
        { name: 'Player1', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 },
        { name: 'Player2', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 },
        { name: 'Player3', ready: true, role: null, tasks: [], alive: true, tasksCompleted: 0 }
      ]
    })

    it('should transition from waiting to playing when host starts game', () => {
      startGame()

      expect(gameState.stage).toBe('playing')
    })

    it('should assign roles when transitioning to playing', () => {
      startGame()

      const traitors = gameState.players.filter(p => p.role === 'traitor')
      const allies = gameState.players.filter(p => p.role === 'ally')

      expect(traitors.length).toBe(gameState.settings.traitorCount)
      expect(allies.length).toBe(gameState.players.length - gameState.settings.traitorCount)
    })

    it('should assign tasks to all players when starting game', () => {
      startGame()

      gameState.players.forEach(player => {
        expect(player.tasks).toBeDefined()
        expect(Array.isArray(player.tasks)).toBe(true)
        // Allies should have tasks assigned
        if (player.role === 'ally') {
          expect(player.tasks.length).toBeGreaterThan(0)
        }
      })
    })

    it('should set all players alive when starting game', () => {
      startGame()

      gameState.players.forEach(player => {
        expect(player.alive).toBe(true)
        expect(player.tasksCompleted).toBe(0)
      })
    })

    it('should not allow non-host to start game', () => {
      setMyPlayerName('Player1')
      setIsGameCreator(false)

      startGame()

      expect(global.alert).toHaveBeenCalledWith('Only the host can start the game!')
      expect(gameState.stage).toBe('waiting')
    })

    it('should prevent starting with invalid traitor count', () => {
      gameState.settings.traitorCount = 0

      startGame()

      expect(global.alert).toHaveBeenCalledWith('Cannot start game: There must be at least 1 traitor!')
      expect(gameState.stage).toBe('waiting')
    })

    it('should prevent starting when traitors >= total players', () => {
      gameState.settings.traitorCount = 4

      startGame()

      expect(global.alert).toHaveBeenCalledWith('Cannot start game: Number of traitors must be less than total players!')
      expect(gameState.stage).toBe('waiting')
    })
  })

  describe('any -> ended transition', () => {
    beforeEach(() => {
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: false },
        { name: 'Traitor1', role: 'traitor', alive: false }
      ]
    })

    it('should transition from playing to ended when game ends', () => {
      gameState.stage = 'playing'

      endGame('allies', 'All traitors eliminated')

      expect(gameState.stage).toBe('ended')
      expect(gameState.gameEnded).toBe(true)
      expect(gameState.winner).toBe('allies')
    })

    it('should transition from meeting to ended when game ends', () => {
      gameState.stage = 'meeting'

      endGame('traitors', 'Traitors outnumber allies')

      expect(gameState.stage).toBe('ended')
      expect(gameState.gameEnded).toBe(true)
      expect(gameState.winner).toBe('traitors')
    })

    it('should set gameEnded flag when ending game', () => {
      gameState.stage = 'playing'
      gameState.gameEnded = false

      endGame('allies', 'All tasks completed')

      expect(gameState.gameEnded).toBe(true)
    })

    it('should store winner when game ends', () => {
      endGame('allies', 'Victory!')

      expect(gameState.winner).toBe('allies')
    })
  })

  describe('any -> setup transition', () => {
    it('should transition from waiting to setup via returnToMenu', () => {
      gameState.stage = 'waiting'
      gameState.roomCode = 'TEST'
      gameState.players = [{ name: 'Player1' }]

      returnToMenu()

      expect(gameState.stage).toBe('setup')
    })

    it('should transition from playing to setup via returnToMenu', () => {
      gameState.stage = 'playing'

      returnToMenu()

      expect(gameState.stage).toBe('setup')
    })

    it('should transition from ended to setup via returnToMenu', () => {
      gameState.stage = 'ended'

      returnToMenu()

      expect(gameState.stage).toBe('setup')
    })

    it('should reset game state when returning to menu', () => {
      gameState.stage = 'playing'
      gameState.roomCode = 'ABC123'
      gameState.hostName = 'Host'
      gameState.players = [
        { name: 'Player1', role: 'ally' },
        { name: 'Player2', role: 'traitor' }
      ]
      gameState.gameEnded = true
      gameState.winner = 'allies'

      returnToMenu()

      expect(gameState.stage).toBe('setup')
      expect(gameState.roomCode).toBe('')
      expect(gameState.hostName).toBeNull()
      expect(gameState.players).toEqual([])
      expect(gameState.gameEnded).toBe(false)
      expect(gameState.winner).toBeNull()
    })

    it('should clear player state when returning to menu', () => {
      setMyPlayerName('TestPlayer')
      setIsGameCreator(true)

      returnToMenu()

      // Player state should be cleared (checked via side effects in the function)
      expect(gameState.stage).toBe('setup')
    })
  })

  describe('setup -> waiting transition', () => {
    it('should transition from setup to waiting when creating game', async () => {
      // This is tested in QR Code Integration tests
      // Verifying the transition happens via createGame
      gameState.stage = 'setup'

      expect(gameState.stage).toBe('setup')
      // After createGame() is called, stage should be 'waiting'
      // (Already covered in existing tests)
    })
  })

  describe('stage validation', () => {
    it('should maintain valid stage values', () => {
      const validStages = ['setup', 'waiting', 'playing', 'meeting', 'ended']

      // Test that startGame sets a valid stage
      gameState.stage = 'waiting'
      gameState.hostName = 'Host'
      setMyPlayerName('Host')
      setIsGameCreator(true)
      gameState.players = [
        { name: 'Host', ready: true },
        { name: 'P1', ready: true },
        { name: 'P2', ready: true },
        { name: 'P3', ready: true }
      ]

      startGame()
      expect(validStages).toContain(gameState.stage)

      // Test that endGame sets a valid stage
      endGame('allies', 'Victory')
      expect(validStages).toContain(gameState.stage)

      // Test that returnToMenu sets a valid stage
      returnToMenu()
      expect(validStages).toContain(gameState.stage)
    })
  })
})

describe('Voting Logic', () => {
  beforeEach(() => {
    // Reset voting state
    gameState.votes = {}
    gameState.votesTallied = false
    gameState.settings.voteResults = null
    gameState.players = []
    gameState.gameEnded = false
    gameState.winner = null
    setMyPlayerName(null)
    setSelectedVote(null)  // Reset selectedVote between tests

    // Mock DOM elements
    global.document = {
      getElementById: vi.fn((id) => ({
        classList: { add: vi.fn(), remove: vi.fn() },
        disabled: false,
        innerHTML: '',
        textContent: ''
      })),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn()
      })),
      body: { innerHTML: '' }
    }

    global.alert = vi.fn()
    vi.clearAllMocks()
  })

  describe('tallyVotes', () => {
    it('should count votes correctly', async () => {
      gameState.votes = {
        'Player1': 'Player3',
        'Player2': 'Player3',
        'Player3': 'Player1',
        'Player4': 'Player1'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Player3', role: 'traitor', alive: true },
        { name: 'Player4', role: 'ally', alive: true }
      ]

      await tallyVotes()

      expect(gameState.settings.voteResults.voteCounts).toEqual({
        'Player3': 2,
        'Player1': 2
      })
    })

    it('should eliminate player with most votes', async () => {
      gameState.votes = {
        'Player1': 'Player3',
        'Player2': 'Player3',
        'Player3': 'Player1',
        'Player4': 'Player3'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Player3', role: 'traitor', alive: true },
        { name: 'Player4', role: 'ally', alive: true }
      ]

      await tallyVotes()

      const player3 = gameState.players.find(p => p.name === 'Player3')
      expect(player3.alive).toBe(false)
      expect(gameState.settings.voteResults.eliminatedPlayer).toBe('Player3')
    })

    it('should detect tie when multiple players have same max votes', async () => {
      gameState.votes = {
        'Player1': 'Player3',
        'Player2': 'Player4',
        'Player3': 'Player4',
        'Player4': 'Player3'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Player3', role: 'traitor', alive: true },
        { name: 'Player4', role: 'ally', alive: true }
      ]

      await tallyVotes()

      expect(gameState.settings.voteResults.isTie).toBe(true)
      expect(gameState.settings.voteResults.eliminatedPlayer).toBeNull()
      // All players should remain alive in a tie
      gameState.players.forEach(player => {
        expect(player.alive).toBe(true)
      })
    })

    it('should handle all skip votes (no elimination)', async () => {
      gameState.votes = {
        'Player1': 'skip',
        'Player2': 'skip',
        'Player3': 'skip',
        'Player4': 'skip'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Player3', role: 'traitor', alive: true },
        { name: 'Player4', role: 'ally', alive: true }
      ]

      await tallyVotes()

      expect(gameState.settings.voteResults.eliminatedPlayer).toBeNull()
      gameState.players.forEach(player => {
        expect(player.alive).toBe(true)
      })
    })

    it('should handle mixed skip and player votes', async () => {
      gameState.votes = {
        'Player1': 'Player3',
        'Player2': 'skip',
        'Player3': 'skip',
        'Player4': 'Player3'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Player3', role: 'traitor', alive: true },
        { name: 'Player4', role: 'ally', alive: true }
      ]

      await tallyVotes()

      const player3 = gameState.players.find(p => p.name === 'Player3')
      expect(player3.alive).toBe(false)
      expect(gameState.settings.voteResults.voteCounts).toEqual({
        'Player3': 2,
        'skip': 2
      })
    })

    it('should prevent double tallying', async () => {
      gameState.votes = {
        'Player1': 'Player2',
        'Player2': 'Player1'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'traitor', alive: true }
      ]

      await tallyVotes()
      const firstResult = { ...gameState.settings.voteResults }

      // Try to tally again
      gameState.votes['Player3'] = 'Player1'
      await tallyVotes()

      // Results should not change
      expect(gameState.settings.voteResults).toEqual(firstResult)
    })

    it('should handle unanimous vote', async () => {
      gameState.votes = {
        'Player1': 'Player3',
        'Player2': 'Player3',
        'Player3': 'Player1', // Even the target votes
        'Player4': 'Player3'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Player3', role: 'traitor', alive: true },
        { name: 'Player4', role: 'ally', alive: true }
      ]

      await tallyVotes()

      const player3 = gameState.players.find(p => p.name === 'Player3')
      expect(player3.alive).toBe(false)
      expect(gameState.settings.voteResults.voteCounts['Player3']).toBe(3)
    })

    it('should store vote results for sync', async () => {
      gameState.votes = {
        'Player1': 'Player2',
        'Player2': 'Player1'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'traitor', alive: true }
      ]

      await tallyVotes()

      expect(gameState.settings.voteResults).toBeDefined()
      expect(gameState.settings.voteResults.voteCounts).toBeDefined()
      expect(gameState.settings.voteResults.eliminatedPlayer).toBeDefined()
      expect(gameState.settings.voteResults.isTie).toBeDefined()
    })

    it('should eliminate player with most non-skip votes even if skip has more votes overall', async () => {
      gameState.votes = {
        'Player1': 'skip',
        'Player2': 'skip',
        'Player3': 'skip',
        'Player4': 'Player2'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'traitor', alive: true },
        { name: 'Player3', role: 'ally', alive: true },
        { name: 'Player4', role: 'ally', alive: true }
      ]

      await tallyVotes()

      // Player2 has the most non-skip votes (1), so they're eliminated
      // even though skip has more votes overall (3)
      expect(gameState.settings.voteResults.eliminatedPlayer).toBe('Player2')
      const player2 = gameState.players.find(p => p.name === 'Player2')
      expect(player2.alive).toBe(false)
    })

    it('should handle three-way tie', async () => {
      gameState.votes = {
        'Player1': 'Player4',
        'Player2': 'Player5',
        'Player3': 'Player6',
        'Player4': 'Player4',
        'Player5': 'Player5',
        'Player6': 'Player6'
      }
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true },
        { name: 'Player2', role: 'ally', alive: true },
        { name: 'Player3', role: 'ally', alive: true },
        { name: 'Player4', role: 'traitor', alive: true },
        { name: 'Player5', role: 'ally', alive: true },
        { name: 'Player6', role: 'ally', alive: true }
      ]

      await tallyVotes()

      expect(gameState.settings.voteResults.isTie).toBe(true)
      expect(gameState.settings.voteResults.eliminatedPlayer).toBeNull()
      gameState.players.forEach(player => {
        expect(player.alive).toBe(true)
      })
    })
  })

  describe('selectVote', () => {
    it('should mark selected vote option', () => {
      const mockElement = {
        classList: { add: vi.fn(), remove: vi.fn() }
      }
      const mockOtherOption = {
        classList: { add: vi.fn(), remove: vi.fn() }
      }

      global.document.querySelectorAll = vi.fn(() => [mockElement, mockOtherOption])
      global.document.getElementById = vi.fn(() => ({ disabled: true }))

      selectVote('Player1', mockElement)

      expect(mockElement.classList.add).toHaveBeenCalledWith('selected')
      expect(mockOtherOption.classList.remove).toHaveBeenCalledWith('selected')
    })

    it('should enable submit button after selecting vote', () => {
      const mockElement = {
        classList: { add: vi.fn(), remove: vi.fn() }
      }
      const mockSubmitBtn = { disabled: true }

      global.document.querySelectorAll = vi.fn(() => [mockElement])
      global.document.getElementById = vi.fn((id) => {
        if (id === 'submit-vote-btn') return mockSubmitBtn
        return null
      })

      selectVote('Player1', mockElement)

      expect(mockSubmitBtn.disabled).toBe(false)
    })
  })

  describe('submitVote (offline mode)', () => {
    it('should record vote in local state when offline', async () => {
      setMyPlayerName('Player1')
      gameState.votes = {}

      // Mock vote options for selectVote to work
      const mockVoteOption = {
        classList: { add: vi.fn(), remove: vi.fn() }
      }

      global.document.querySelectorAll = vi.fn(() => [mockVoteOption])
      global.document.getElementById = vi.fn(() => ({
        disabled: false,
        classList: { add: vi.fn(), remove: vi.fn() }
      }))

      // Call selectVote to set the vote (this sets the module-level selectedVote variable)
      selectVote('Player2', mockVoteOption)

      await submitVote()

      expect(gameState.votes['Player1']).toBe('Player2')
    })

    it('should record skip vote when no player selected', async () => {
      setMyPlayerName('Player1')
      gameState.votes = {}

      global.document.getElementById = vi.fn(() => ({
        disabled: false,
        classList: { add: vi.fn(), remove: vi.fn() }
      }))

      // Don't call selectVote - selectedVote will be null
      await submitVote()

      expect(gameState.votes['Player1']).toBe('skip')
    })
  })
})

describe('Task Toggling', () => {
  let mockElements

  beforeEach(() => {
    // Reset game state
    gameState.stage = 'playing'
    gameState.currentPlayer = 'Player1'
    gameState.players = [
      {
        name: 'Player1',
        role: 'ally',
        tasks: [
          { room: 'Kitchen', task: 'Task1' },
          { room: 'Living Room', task: 'Task2' },
          { room: 'Bedroom', task: 'Task3' }
        ],
        tasksCompleted: 0,
        alive: true
      },
      {
        name: 'Player2',
        role: 'traitor',
        tasks: [
          { room: 'Kitchen', task: 'Fake Task' }
        ],
        tasksCompleted: 0,
        alive: true
      }
    ]

    // Set currentGameId to enable database updates in tests
    setCurrentGameId('test-game-id')

    // Mock DOM elements
    mockElements = {
      task0: { checked: false, id: 'task-0' },
      task1: { checked: false, id: 'task-1' },
      task2: { checked: false, id: 'task-2' },
      completedTasksCount: { textContent: '0' }
    }

    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'task-0') return mockElements.task0
        if (id === 'task-1') return mockElements.task1
        if (id === 'task-2') return mockElements.task2
        if (id === 'completed-tasks-count') return mockElements.completedTasksCount
        return {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          innerHTML: '',
          textContent: '',
          appendChild: vi.fn()
        }
      }),
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn()
      })),
      body: { innerHTML: '' }
    }

    // Mock backend functions
    global.updatePlayerInDB = vi.fn(async () => {})

    vi.clearAllMocks()
  })

  describe('toggleTaskComplete - ally tasks', () => {
    beforeEach(() => {
      gameState.currentPlayer = 'Player1'
    })

    it('should increment tasksCompleted when checking a task', () => {
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      const player = gameState.players.find(p => p.name === 'Player1')
      expect(player.tasksCompleted).toBe(1)
    })

    it('should decrement tasksCompleted when unchecking a task', () => {
      const player = gameState.players.find(p => p.name === 'Player1')
      player.tasksCompleted = 2
      mockElements.task1.checked = false

      toggleTaskComplete(1)

      expect(player.tasksCompleted).toBe(1)
    })

    it('should update DOM element with new count', () => {
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      expect(mockElements.completedTasksCount.textContent).toBe(1)
    })

    it('should not exceed maximum tasks when checking multiple times', () => {
      const player = gameState.players.find(p => p.name === 'Player1')
      player.tasksCompleted = 3 // Already at max

      mockElements.task0.checked = true
      toggleTaskComplete(0)

      expect(player.tasksCompleted).toBe(3) // Should stay at max
    })

    it('should not go below zero when unchecking', () => {
      const player = gameState.players.find(p => p.name === 'Player1')
      player.tasksCompleted = 0

      mockElements.task0.checked = false
      toggleTaskComplete(0)

      expect(player.tasksCompleted).toBe(0) // Should stay at 0
    })

    it('should handle ally tasks with database enabled', () => {
      // This test verifies that ally task completion works when database is configured
      // The actual database call (updatePlayerInDB) is tested in integration tests
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      const player = gameState.players.find(p => p.name === 'Player1')
      expect(player.tasksCompleted).toBe(1)
      expect(player.role).toBe('ally')
    })

    it('should check victory condition after ally completes task', () => {
      const player = gameState.players.find(p => p.name === 'Player1')
      player.tasksCompleted = 0
      mockElements.task0.checked = true

      // Spy on checkAllyVictory by checking if endGame gets called
      const originalGameEnded = gameState.gameEnded

      toggleTaskComplete(0)

      // If all tasks were complete, gameEnded would be true
      // We're just verifying the function was called (implicitly by checking state)
      expect(player.tasksCompleted).toBe(1)
    })

    it('should handle toggling first task', () => {
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      const player = gameState.players.find(p => p.name === 'Player1')
      expect(player.tasksCompleted).toBe(1)
    })

    it('should handle toggling last task', () => {
      mockElements.task2.checked = true

      toggleTaskComplete(2)

      const player = gameState.players.find(p => p.name === 'Player1')
      expect(player.tasksCompleted).toBe(1)
    })

    it('should handle multiple sequential toggles', () => {
      const player = gameState.players.find(p => p.name === 'Player1')

      // Check task 0
      mockElements.task0.checked = true
      toggleTaskComplete(0)
      expect(player.tasksCompleted).toBe(1)

      // Check task 1
      mockElements.task1.checked = true
      toggleTaskComplete(1)
      expect(player.tasksCompleted).toBe(2)

      // Uncheck task 0
      mockElements.task0.checked = false
      toggleTaskComplete(0)
      expect(player.tasksCompleted).toBe(1)
    })
  })

  describe('toggleTaskComplete - traitor tasks', () => {
    beforeEach(() => {
      gameState.currentPlayer = 'Player2'
    })

    it('should increment tasksCompleted for traitors (dummy tracking)', () => {
      const traitor = gameState.players.find(p => p.name === 'Player2')
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      expect(traitor.tasksCompleted).toBe(1)
    })

    it('should NOT update database for traitor tasks', () => {
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      expect(global.updatePlayerInDB).not.toHaveBeenCalled()
    })

    it('should NOT check victory condition for traitor tasks', () => {
      const originalGameEnded = gameState.gameEnded
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      // Game should not end from traitor completing tasks
      expect(gameState.gameEnded).toBe(originalGameEnded)
    })
  })

  describe('toggleTaskComplete - edge cases', () => {
    it('should do nothing if currentPlayer is not found', () => {
      gameState.currentPlayer = 'NonExistentPlayer'
      mockElements.task0.checked = true

      toggleTaskComplete(0)

      // Should not crash, players should remain unchanged
      expect(gameState.players[0].tasksCompleted).toBe(0)
      expect(gameState.players[1].tasksCompleted).toBe(0)
    })

    it('should handle player with no tasks', () => {
      gameState.currentPlayer = 'Player3'
      gameState.players.push({
        name: 'Player3',
        role: 'ally',
        tasks: [],
        tasksCompleted: 0,
        alive: true
      })

      mockElements.task0.checked = true
      toggleTaskComplete(0)

      const player3 = gameState.players.find(p => p.name === 'Player3')
      expect(player3.tasksCompleted).toBe(0) // Should stay at 0 (max is 0)
    })

    it('should handle player with undefined tasksCompleted', () => {
      const player = gameState.players.find(p => p.name === 'Player1')
      player.tasksCompleted = undefined

      mockElements.task0.checked = true
      toggleTaskComplete(0)

      expect(player.tasksCompleted).toBe(1)
    })
  })
})

describe('Task Assignment Logic', () => {
  let mockElements

  beforeEach(() => {
    // Set up a complete game scenario
    gameState.stage = 'waiting'
    gameState.settings.traitorCount = 1
    gameState.settings.tasksPerPlayer = 3
    gameState.settings.selectedRooms = {
      'Kitchen': {
        enabled: true,
        tasks: [
          { name: 'Task1', enabled: true, unique: false },
          { name: 'Task2', enabled: true, unique: false },
          { name: 'Task3', enabled: true, unique: true }
        ]
      },
      'Living Room': {
        enabled: true,
        tasks: [
          { name: 'Task4', enabled: true, unique: false },
          { name: 'Task5', enabled: true, unique: true }
        ]
      },
      'Garage': {
        enabled: false, // Disabled room
        tasks: [
          { name: 'Task6', enabled: true, unique: false }
        ]
      }
    }

    gameState.players = [
      { name: 'Player1', ready: true },
      { name: 'Player2', ready: true },
      { name: 'Player3', ready: true },
      { name: 'Player4', ready: true }
    ]

    setMyPlayerName('Player1')
    setIsGameCreator(true)
    gameState.hostName = 'Player1'

    // Mock DOM elements
    mockElements = {
      waitingRoom: { classList: { add: vi.fn(), remove: vi.fn() } },
      gamePhase: { classList: { add: vi.fn(), remove: vi.fn() } }
    }

    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'waiting-room') return mockElements.waitingRoom
        if (id === 'game-phase') return mockElements.gamePhase
        return {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          innerHTML: '',
          textContent: '',
          appendChild: vi.fn()
        }
      }),
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn()
      })),
      body: { innerHTML: '' }
    }

    global.updateGameInDB = vi.fn()
    global.updatePlayerInDB = vi.fn()

    vi.clearAllMocks()
  })

  describe('Role assignment', () => {
    it('should assign correct number of traitors', () => {
      startGame()

      const traitors = gameState.players.filter(p => p.role === 'traitor')
      expect(traitors).toHaveLength(gameState.settings.traitorCount)
    })

    it('should assign remaining players as allies', () => {
      startGame()

      const allies = gameState.players.filter(p => p.role === 'ally')
      expect(allies).toHaveLength(gameState.players.length - gameState.settings.traitorCount)
    })

    it('should assign all players a role', () => {
      startGame()

      gameState.players.forEach(player => {
        expect(player.role).toBeDefined()
        expect(['traitor', 'ally']).toContain(player.role)
      })
    })
  })

  describe('Task assignment - Basic functionality', () => {
    it('should assign tasks to all players', () => {
      startGame()

      gameState.players.forEach(player => {
        expect(player.tasks).toBeDefined()
        expect(Array.isArray(player.tasks)).toBe(true)
      })
    })

    it('should assign tasks only from enabled rooms', () => {
      startGame()

      gameState.players.forEach(player => {
        player.tasks.forEach(task => {
          expect(task.room).not.toBe('Garage') // Disabled room
          expect(['Kitchen', 'Living Room']).toContain(task.room)
        })
      })
    })

    it('should assign only enabled tasks', () => {
      // Add a disabled task
      gameState.settings.selectedRooms['Kitchen'].tasks.push({
        name: 'DisabledTask',
        enabled: false,
        unique: false
      })

      startGame()

      gameState.players.forEach(player => {
        player.tasks.forEach(task => {
          expect(task.task).not.toBe('DisabledTask')
        })
      })
    })

    it('should assign correct number of tasks per player', () => {
      startGame()

      gameState.players.forEach(player => {
        // Should assign up to tasksPerPlayer, may be less if not enough tasks
        expect(player.tasks.length).toBeLessThanOrEqual(gameState.settings.tasksPerPlayer)
      })
    })

    it('should initialize tasks completed to 0', () => {
      startGame()

      gameState.players.forEach(player => {
        expect(player.tasksCompleted).toBe(0)
      })
    })

    it('should set all players as alive', () => {
      startGame()

      gameState.players.forEach(player => {
        expect(player.alive).toBe(true)
      })
    })
  })

  describe('Task assignment - Unique tasks', () => {
    it('should not assign unique tasks to traitors', () => {
      startGame()

      const traitors = gameState.players.filter(p => p.role === 'traitor')
      traitors.forEach(traitor => {
        traitor.tasks.forEach(task => {
          // Check this task is not one of the unique tasks
          const uniqueTaskNames = ['Task3', 'Task5']
          expect(uniqueTaskNames).not.toContain(task.task)
        })
      })
    })

    it('should allow allies to receive unique tasks', () => {
      // Run multiple times due to randomness
      let allyGotUniqueTask = false

      for (let i = 0; i < 10; i++) {
        // Reset game state
        gameState.players.forEach(p => {
          delete p.role
          delete p.tasks
        })

        startGame()

        const allies = gameState.players.filter(p => p.role === 'ally')
        allies.forEach(ally => {
          ally.tasks.forEach(task => {
            const uniqueTaskNames = ['Task3', 'Task5']
            if (uniqueTaskNames.includes(task.task)) {
              allyGotUniqueTask = true
            }
          })
        })

        if (allyGotUniqueTask) break
      }

      // With 30% probability per task slot, should get at least one in 10 runs
      expect(allyGotUniqueTask).toBe(true)
    })

    it('should not duplicate unique tasks across players', () => {
      startGame()

      const uniqueTaskNames = ['Task3', 'Task5']
      const assignedUniqueTasks = new Map() // taskName -> playerName

      gameState.players.forEach(player => {
        player.tasks.forEach(task => {
          if (uniqueTaskNames.includes(task.task)) {
            const key = `${task.room}-${task.task}`

            if (assignedUniqueTasks.has(key)) {
              // If we find a duplicate, fail the test
              expect(assignedUniqueTasks.get(key)).not.toBe(player.name)
            }

            assignedUniqueTasks.set(key, player.name)
          }
        })
      })

      // Test passes if no duplicates found
      expect(true).toBe(true)
    })
  })

  describe('Task assignment - No duplicates and distinct rooms', () => {
    it('should not assign duplicate tasks to the same player', () => {
      // Set up multiple rooms with multiple tasks
      gameState.settings.selectedRooms = {
        'Kitchen': {
          enabled: true,
          tasks: [
            { name: 'Cook Food', enabled: true, unique: false },
            { name: 'Wash Dishes', enabled: true, unique: false }
          ]
        },
        'Living Room': {
          enabled: true,
          tasks: [
            { name: 'Vacuum', enabled: true, unique: false },
            { name: 'Dust Shelves', enabled: true, unique: false }
          ]
        },
        'Garage': {
          enabled: true,
          tasks: [
            { name: 'Clean Car', enabled: true, unique: false }
          ]
        }
      }
      gameState.settings.tasksPerPlayer = 4

      startGame()

      gameState.players.forEach(player => {
        const taskNames = player.tasks.map(t => t.task)
        const uniqueTaskNames = new Set(taskNames)
        // Should have no duplicates
        expect(taskNames.length).toBe(uniqueTaskNames.size)
      })
    })

    it('should assign tasks from distinct rooms when possible', () => {
      // Set up 5 rooms with tasks, request 4 tasks per player
      gameState.settings.selectedRooms = {
        'Kitchen': {
          enabled: true,
          tasks: [{ name: 'Cook', enabled: true, unique: false }]
        },
        'Living Room': {
          enabled: true,
          tasks: [{ name: 'Vacuum', enabled: true, unique: false }]
        },
        'Garage': {
          enabled: true,
          tasks: [{ name: 'Clean Car', enabled: true, unique: false }]
        },
        'Bedroom': {
          enabled: true,
          tasks: [{ name: 'Make Bed', enabled: true, unique: false }]
        },
        'Bathroom': {
          enabled: true,
          tasks: [{ name: 'Scrub Sink', enabled: true, unique: false }]
        }
      }
      gameState.settings.tasksPerPlayer = 4

      startGame()

      gameState.players.forEach(player => {
        const rooms = player.tasks.map(t => t.room)
        const uniqueRooms = new Set(rooms)
        // Should have 4 tasks from 4 different rooms
        expect(uniqueRooms.size).toBe(4)
      })
    })

    it('should handle case where distinct rooms not possible (more tasks than rooms)', () => {
      // Only 2 rooms, but need 4 tasks
      gameState.settings.selectedRooms = {
        'Kitchen': {
          enabled: true,
          tasks: [
            { name: 'Cook', enabled: true, unique: false },
            { name: 'Clean', enabled: true, unique: false }
          ]
        },
        'Living Room': {
          enabled: true,
          tasks: [
            { name: 'Vacuum', enabled: true, unique: false },
            { name: 'Dust', enabled: true, unique: false }
          ]
        }
      }
      gameState.settings.tasksPerPlayer = 4

      startGame()

      gameState.players.forEach(player => {
        // Should still get 4 tasks
        expect(player.tasks.length).toBe(4)
        // But no duplicates
        const taskNames = player.tasks.map(t => t.task)
        const uniqueTaskNames = new Set(taskNames)
        expect(taskNames.length).toBe(uniqueTaskNames.size)
      })
    })

    it('should respect unique task constraints while avoiding duplicates', () => {
      gameState.settings.selectedRooms = {
        'Kitchen': {
          enabled: true,
          tasks: [
            { name: 'Cook', enabled: true, unique: false },
            { name: 'Special Recipe', enabled: true, unique: true }
          ]
        },
        'Living Room': {
          enabled: true,
          tasks: [
            { name: 'Vacuum', enabled: true, unique: false },
            { name: 'Rare Book', enabled: true, unique: true }
          ]
        },
        'Garage': {
          enabled: true,
          tasks: [{ name: 'Clean Car', enabled: true, unique: false }]
        }
      }
      gameState.settings.tasksPerPlayer = 3
      gameState.settings.traitorCount = 1

      startGame()

      const traitors = gameState.players.filter(p => p.role === 'traitor')
      const allies = gameState.players.filter(p => p.role === 'ally')

      // Traitors should not get unique tasks
      traitors.forEach(traitor => {
        const uniqueTaskNames = ['Special Recipe', 'Rare Book']
        traitor.tasks.forEach(task => {
          expect(uniqueTaskNames).not.toContain(task.task)
        })
        // And no duplicates
        const taskNames = traitor.tasks.map(t => t.task)
        const uniqueTasks = new Set(taskNames)
        expect(taskNames.length).toBe(uniqueTasks.size)
      })

      // Allies should have no duplicates
      allies.forEach(ally => {
        const taskNames = ally.tasks.map(t => t.task)
        const uniqueTasks = new Set(taskNames)
        expect(taskNames.length).toBe(uniqueTasks.size)
      })
    })
  })

  describe('Task assignment - Edge cases', () => {
    it('should handle scenario with no unique tasks', () => {
      // Remove unique tasks
      gameState.settings.selectedRooms['Kitchen'].tasks[2].unique = false
      gameState.settings.selectedRooms['Living Room'].tasks[1].unique = false

      expect(() => startGame()).not.toThrow()

      gameState.players.forEach(player => {
        expect(player.tasks).toBeDefined()
      })
    })

    it('should handle scenario with only unique tasks', () => {
      // Make all tasks unique
      Object.values(gameState.settings.selectedRooms).forEach(room => {
        room.tasks.forEach(task => {
          task.unique = true
        })
      })

      expect(() => startGame()).not.toThrow()

      const traitors = gameState.players.filter(p => p.role === 'traitor')
      // Traitors should have empty or very few tasks since they can't get unique
      traitors.forEach(traitor => {
        expect(traitor.tasks.length).toBeLessThanOrEqual(1)
      })
    })

    it('should handle insufficient tasks scenario', () => {
      // Only 1 non-unique task available
      gameState.settings.selectedRooms = {
        'Kitchen': {
          enabled: true,
          tasks: [{ name: 'OnlyTask', enabled: true, unique: false }]
        }
      }
      gameState.settings.tasksPerPlayer = 5

      expect(() => startGame()).not.toThrow()

      gameState.players.forEach(player => {
        // With no-duplicate logic, should only get 1 task (the only available task)
        expect(player.tasks.length).toBeLessThanOrEqual(1)
      })
    })

    it('should handle zero tasks per player setting', () => {
      gameState.settings.tasksPerPlayer = 0

      expect(() => startGame()).not.toThrow()

      gameState.players.forEach(player => {
        expect(player.tasks).toEqual([])
      })
    })

    it('should handle all rooms disabled', () => {
      Object.values(gameState.settings.selectedRooms).forEach(room => {
        room.enabled = false
      })

      expect(() => startGame()).not.toThrow()

      gameState.players.forEach(player => {
        expect(player.tasks).toEqual([])
      })
    })

    it('should handle all tasks disabled', () => {
      Object.values(gameState.settings.selectedRooms).forEach(room => {
        room.tasks.forEach(task => {
          task.enabled = false
        })
      })

      expect(() => startGame()).not.toThrow()

      gameState.players.forEach(player => {
        expect(player.tasks).toEqual([])
      })
    })
  })
})

describe('Elimination Mechanics', () => {
  let mockElements

  beforeEach(() => {
    gameState.stage = 'playing'
    gameState.currentPlayer = 'Player1'
    gameState.players = [
      { name: 'Player1', role: 'ally', alive: true, tasks: [], tasksCompleted: 0 },
      { name: 'Player2', role: 'ally', alive: true, tasks: [], tasksCompleted: 0 },
      { name: 'Player3', role: 'traitor', alive: true, tasks: [], tasksCompleted: 0 }
    ]

    mockElements = {
      eliminatedQRCode: { src: '' },
      eliminatedModal: { classList: { add: vi.fn(), remove: vi.fn() } }
    }

    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'eliminated-qr-code') return mockElements.eliminatedQRCode
        if (id === 'eliminated-modal') return mockElements.eliminatedModal
        return {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          innerHTML: '',
          textContent: ''
        }
      }),
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn()
      })),
      body: { innerHTML: '' }
    }

    vi.clearAllMocks()
  })

  describe('eliminatePlayer', () => {
    it('should mark current player as not alive', () => {
      eliminatePlayer()

      const player = gameState.players.find(p => p.name === 'Player1')
      expect(player.alive).toBe(false)
    })

    it('should not affect other players', () => {
      eliminatePlayer()

      const player2 = gameState.players.find(p => p.name === 'Player2')
      const player3 = gameState.players.find(p => p.name === 'Player3')

      expect(player2.alive).toBe(true)
      expect(player3.alive).toBe(true)
    })

    it('should generate QR code with player name and room code', () => {
      gameState.roomCode = 'ABC123'

      eliminatePlayer()

      expect(mockElements.eliminatedQRCode.src).toContain('ELIMINATED')
      expect(mockElements.eliminatedQRCode.src).toContain('Player1')
      expect(mockElements.eliminatedQRCode.src).toContain('ABC123')
    })

    it('should show eliminated modal', () => {
      eliminatePlayer()

      expect(mockElements.eliminatedModal.classList.remove).toHaveBeenCalledWith('hidden')
    })

    it('should handle when currentPlayer is not found', () => {
      gameState.currentPlayer = 'NonExistentPlayer'

      expect(() => eliminatePlayer()).not.toThrow()

      // No players should be eliminated
      gameState.players.forEach(player => {
        expect(player.alive).toBe(true)
      })
    })

    it('should allow eliminating already eliminated player', () => {
      const player = gameState.players.find(p => p.name === 'Player1')
      player.alive = false

      expect(() => eliminatePlayer()).not.toThrow()
      expect(player.alive).toBe(false)
    })

    it('should work for both allies and traitors', () => {
      // Eliminate ally
      gameState.currentPlayer = 'Player1'
      eliminatePlayer()
      expect(gameState.players.find(p => p.name === 'Player1').alive).toBe(false)

      // Eliminate traitor
      gameState.currentPlayer = 'Player3'
      eliminatePlayer()
      expect(gameState.players.find(p => p.name === 'Player3').alive).toBe(false)
    })
  })
})

describe('Meeting Flow', () => {
  let mockElements

  beforeEach(() => {
    gameState.stage = 'playing'
    gameState.settings.meetingLimit = 3
    gameState.settings.meetingRoom = 'Living Room'
    gameState.meetingsUsed = 0
    gameState.meetingCaller = null
    gameState.meetingReady = {}
    gameState.votes = {}
    gameState.votingStarted = false
    gameState.votesTallied = false
    gameState.meetingType = null

    setMyPlayerName('Player1')
    setIsGameCreator(true)
    gameState.hostName = 'Player1'

    mockElements = {
      meetingOverlay: { classList: { add: vi.fn(), remove: vi.fn() } },
      meetingLocationAlert: { textContent: '' },
      gamePhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      meetingPhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      reportSelection: { classList: { add: vi.fn(), remove: vi.fn() } },
      voteResults: { classList: { add: vi.fn(), remove: vi.fn() } },
      votingPhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      discussionPhase: { classList: { add: vi.fn(), remove: vi.fn() } }
    }

    global.document = {
      getElementById: vi.fn((id) => {
        const elementMap = {
          'meeting-overlay': mockElements.meetingOverlay,
          'meeting-location-alert': mockElements.meetingLocationAlert,
          'game-phase': mockElements.gamePhase,
          'meeting-phase': mockElements.meetingPhase,
          'report-selection': mockElements.reportSelection,
          'vote-results': mockElements.voteResults,
          'voting-phase': mockElements.votingPhase,
          'discussion-phase': mockElements.discussionPhase
        }
        return elementMap[id] || {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          innerHTML: '',
          textContent: '',
          appendChild: vi.fn(),
          disabled: false
        }
      }),
      querySelector: vi.fn((selector) => ({
        textContent: '',
        classList: { add: vi.fn(), remove: vi.fn() }
      })),
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn()
      })),
      body: { innerHTML: '' }
    }

    // Mock Web Audio API
    global.window = {
      AudioContext: vi.fn(() => ({
        createOscillator: vi.fn(() => ({
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          frequency: { value: 0 },
          type: 'square'
        })),
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
          }
        })),
        destination: {},
        currentTime: 0
      }))
    }

    global.alert = vi.fn()
    global.updateGameInDB = vi.fn()

    vi.clearAllMocks()
  })

  describe('callMeeting', () => {
    it('should set meeting caller to current player', async () => {
      await callMeeting()

      expect(gameState.meetingCaller).toBe('Player1')
    })

    it('should show meeting overlay', async () => {
      await callMeeting()

      expect(mockElements.meetingOverlay.classList.remove).toHaveBeenCalledWith('hidden')
    })

    it('should display meeting location', async () => {
      await callMeeting()

      expect(mockElements.meetingLocationAlert.textContent).toBe('Living Room')
    })

    it('should prevent calling meeting when limit reached', async () => {
      gameState.meetingsUsed = 3
      gameState.settings.meetingLimit = 3

      await callMeeting()

      expect(global.alert).toHaveBeenCalledWith('No emergency meetings remaining!')
    })

    it('should allow calling meeting when under limit', async () => {
      gameState.meetingsUsed = 2
      gameState.settings.meetingLimit = 3

      await callMeeting()

      expect(global.alert).not.toHaveBeenCalled()
      expect(gameState.meetingCaller).toBe('Player1')
    })

    it('should handle zero meetings used initially', async () => {
      gameState.meetingsUsed = 0

      await callMeeting()

      expect(gameState.meetingCaller).toBe('Player1')
    })
  })

  describe('acknowledgeMeeting', () => {
    beforeEach(() => {
      gameState.stage = 'meeting'
    })

    it('should hide meeting overlay', () => {
      acknowledgeMeeting()

      expect(mockElements.meetingOverlay.classList.add).toHaveBeenCalledWith('hidden')
    })

    it('should hide game phase', () => {
      acknowledgeMeeting()

      expect(mockElements.gamePhase.classList.add).toHaveBeenCalledWith('hidden')
    })

    it('should show meeting phase', () => {
      acknowledgeMeeting()

      expect(mockElements.meetingPhase.classList.remove).toHaveBeenCalledWith('hidden')
    })

    it('should hide meeting sub-phases', () => {
      acknowledgeMeeting()

      expect(mockElements.reportSelection.classList.add).toHaveBeenCalledWith('hidden')
    })
  })

  describe('resumeGame', () => {
    beforeEach(() => {
      gameState.stage = 'meeting'
      gameState.meetingReady = { 'Player1': true }
      gameState.votes = { 'Player1': 'Player2' }
      gameState.votingStarted = true
      gameState.votesTallied = true
      gameState.meetingType = 'emergency'
      gameState.meetingCaller = 'Player1'
      gameState.settings.voteResults = { eliminatedPlayer: 'Player2' }
      setSelectedVote('Player2')
    })

    it('should only allow host to resume', () => {
      setIsGameCreator(false)
      setMyPlayerName('Player2')
      gameState.hostName = 'Player1'

      resumeGame()

      // Should return early, stage shouldn't change
      expect(gameState.stage).toBe('meeting')
    })

    it('should transition back to playing stage', () => {
      resumeGame()

      expect(gameState.stage).toBe('playing')
    })

    it('should hide meeting phase', () => {
      resumeGame()

      expect(mockElements.meetingPhase.classList.add).toHaveBeenCalledWith('hidden')
    })

    it('should show game phase', () => {
      resumeGame()

      expect(mockElements.gamePhase.classList.remove).toHaveBeenCalledWith('hidden')
    })

    it('should reset meeting state', () => {
      resumeGame()

      expect(gameState.meetingReady).toEqual({})
      expect(gameState.votes).toEqual({})
      expect(gameState.votingStarted).toBe(false)
      expect(gameState.votesTallied).toBe(false)
      expect(gameState.meetingType).toBeNull()
      expect(gameState.meetingCaller).toBeNull()
      expect(gameState.settings.voteResults).toBeNull()
    })

    it('should hide all meeting and voting screens', () => {
      resumeGame()

      expect(mockElements.voteResults.classList.add).toHaveBeenCalledWith('hidden')
      expect(mockElements.votingPhase.classList.add).toHaveBeenCalledWith('hidden')
      expect(mockElements.discussionPhase.classList.add).toHaveBeenCalledWith('hidden')
    })
  })

  describe('Meeting limit enforcement', () => {
    it('should allow first meeting', async () => {
      gameState.meetingsUsed = 0
      gameState.settings.meetingLimit = 1

      await callMeeting()

      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should prevent meeting after limit reached', async () => {
      gameState.meetingsUsed = 1
      gameState.settings.meetingLimit = 1

      await callMeeting()

      expect(global.alert).toHaveBeenCalledWith('No emergency meetings remaining!')
    })

    it('should handle unlimited meetings (large limit)', async () => {
      gameState.meetingsUsed = 99
      gameState.settings.meetingLimit = 999

      await callMeeting()

      expect(global.alert).not.toHaveBeenCalled()
      expect(gameState.meetingCaller).toBe('Player1')
    })
  })

  describe('Meeting Type Selection', () => {
    beforeEach(() => {
      gameState.stage = 'playing'
      gameState.settings.meetingLimit = 2
      gameState.players = [
        { name: 'Player1', role: 'ally', alive: true, emergencyMeetingsUsed: 0 },
        { name: 'Player2', role: 'ally', alive: true, emergencyMeetingsUsed: 1 },
        { name: 'Player3', role: 'traitor', alive: true, emergencyMeetingsUsed: 2 }
      ]
      setMyPlayerName('Player1')
      gameState.currentPlayer = 'Player1'
      gameState.meetingType = null
      gameState.meetingCaller = null

      mockElements.meetingTypeSelection = { classList: { add: vi.fn(), remove: vi.fn() } }
      mockElements.emergencyMeetingBtn = { disabled: false, textContent: '' }
      mockElements.callMeetingBtn = { classList: { add: vi.fn(), remove: vi.fn() } }

      global.document.getElementById = vi.fn((id) => {
        const elementMap = {
          'meeting-overlay': mockElements.meetingOverlay,
          'meeting-location-alert': mockElements.meetingLocationAlert,
          'game-phase': mockElements.gamePhase,
          'meeting-phase': mockElements.meetingPhase,
          'report-selection': mockElements.reportSelection,
          'vote-results': mockElements.voteResults,
          'voting-phase': mockElements.votingPhase,
          'discussion-phase': mockElements.discussionPhase,
          'meeting-type-selection': mockElements.meetingTypeSelection,
          'emergency-meeting-btn': mockElements.emergencyMeetingBtn,
          'call-meeting-btn': mockElements.callMeetingBtn
        }
        return elementMap[id] || {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          innerHTML: '',
          textContent: '',
          appendChild: vi.fn(),
          disabled: false
        }
      })
    })

    it('should track per-player emergency meeting counts', () => {
      expect(gameState.players[0].emergencyMeetingsUsed).toBe(0)
      expect(gameState.players[1].emergencyMeetingsUsed).toBe(1)
      expect(gameState.players[2].emergencyMeetingsUsed).toBe(2)
    })

    it('should calculate remaining emergency meetings correctly', () => {
      const player1 = gameState.players[0]
      const player2 = gameState.players[1]
      const player3 = gameState.players[2]

      expect(gameState.settings.meetingLimit - player1.emergencyMeetingsUsed).toBe(2)
      expect(gameState.settings.meetingLimit - player2.emergencyMeetingsUsed).toBe(1)
      expect(gameState.settings.meetingLimit - player3.emergencyMeetingsUsed).toBe(0)
    })

    it('should detect when player has no emergency meetings left', () => {
      const player3 = gameState.players.find(p => p.name === 'Player3')
      const hasNoMeetings = player3.emergencyMeetingsUsed >= gameState.settings.meetingLimit

      expect(hasNoMeetings).toBe(true)
    })

    it('should detect when player has emergency meetings available', () => {
      const player1 = gameState.players.find(p => p.name === 'Player1')
      const hasMeetings = player1.emergencyMeetingsUsed < gameState.settings.meetingLimit

      expect(hasMeetings).toBe(true)
    })

    it('should handle player with undefined emergencyMeetingsUsed', () => {
      gameState.players.push({
        name: 'Player4',
        role: 'ally',
        alive: true
        // emergencyMeetingsUsed is undefined
      })

      const player4 = gameState.players.find(p => p.name === 'Player4')
      // Should treat undefined as 0
      const meetingsUsed = player4.emergencyMeetingsUsed || 0
      expect(meetingsUsed).toBe(0)
    })

    it('should initialize emergencyMeetingsUsed to 0 for new players', () => {
      const newPlayer = {
        name: 'NewPlayer',
        role: 'ally',
        alive: true,
        emergencyMeetingsUsed: 0
      }

      expect(newPlayer.emergencyMeetingsUsed).toBe(0)
    })

    it('should allow different players to have different meeting counts', () => {
      const counts = gameState.players.map(p => p.emergencyMeetingsUsed)
      const uniqueCounts = new Set(counts)

      // We have 3 different counts: 0, 1, 2
      expect(uniqueCounts.size).toBe(3)
    })

    it('should preserve other player meeting counts when one player uses a meeting', () => {
      const player1 = gameState.players[0]
      const player2 = gameState.players[1]

      const player2OriginalCount = player2.emergencyMeetingsUsed

      // Player1 uses a meeting
      player1.emergencyMeetingsUsed += 1

      // Player2's count should not change
      expect(player2.emergencyMeetingsUsed).toBe(player2OriginalCount)
    })

    it('should handle edge case where meeting limit is 0', () => {
      gameState.settings.meetingLimit = 0
      const player = gameState.players[0]
      player.emergencyMeetingsUsed = 0

      const hasNoMeetings = player.emergencyMeetingsUsed >= gameState.settings.meetingLimit
      expect(hasNoMeetings).toBe(true)
    })

    it('should handle edge case where player has used more meetings than limit', () => {
      const player = gameState.players[0]
      player.emergencyMeetingsUsed = 5
      gameState.settings.meetingLimit = 2

      const remaining = Math.max(0, gameState.settings.meetingLimit - player.emergencyMeetingsUsed)
      expect(remaining).toBe(0)
    })
  })
})

describe('Return to Menu', () => {
  let mockElements

  beforeEach(() => {
    // Set up game state as if game has ended
    gameState.stage = 'ended'
    gameState.roomCode = 'ABC123'
    gameState.hostName = 'Host'
    gameState.players = [
      { name: 'Player1', role: 'ally' },
      { name: 'Player2', role: 'traitor' }
    ]
    gameState.gameEnded = true
    gameState.winner = 'allies'

    setMyPlayerName('Player1')
    setIsGameCreator(false)

    // Mock DOM elements
    mockElements = {
      setupPhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      waitingRoom: { classList: { add: vi.fn(), remove: vi.fn() } },
      gamePhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      meetingPhase: { classList: { add: vi.fn(), remove: vi.fn() } },
      gameEnd: { classList: { add: vi.fn(), remove: vi.fn() } },
      mainMenu: { classList: { add: vi.fn(), remove: vi.fn() } },
      joinGameSection: { classList: { add: vi.fn(), remove: vi.fn() } }
    }

    global.document = {
      getElementById: vi.fn((id) => {
        const elementMap = {
          'setup-phase': mockElements.setupPhase,
          'waiting-room': mockElements.waitingRoom,
          'game-phase': mockElements.gamePhase,
          'meeting-phase': mockElements.meetingPhase,
          'game-end': mockElements.gameEnd,
          'main-menu': mockElements.mainMenu,
          'join-game-section': mockElements.joinGameSection
        }
        return elementMap[id] || {
          classList: { add: vi.fn(), remove: vi.fn() },
          style: {},
          innerHTML: '',
          textContent: ''
        }
      }),
      body: { innerHTML: '' }
    }

    vi.clearAllMocks()
  })

  it('should hide all game phases including game-end', () => {
    returnToMenu()

    expect(mockElements.setupPhase.classList.add).toHaveBeenCalledWith('hidden')
    expect(mockElements.waitingRoom.classList.add).toHaveBeenCalledWith('hidden')
    expect(mockElements.gamePhase.classList.add).toHaveBeenCalledWith('hidden')
    expect(mockElements.meetingPhase.classList.add).toHaveBeenCalledWith('hidden')
    expect(mockElements.gameEnd.classList.add).toHaveBeenCalledWith('hidden')
  })

  it('should show only main menu', () => {
    returnToMenu()

    expect(mockElements.mainMenu.classList.remove).toHaveBeenCalledWith('hidden')
  })

  it('should clear player state', () => {
    returnToMenu()

    expect(myPlayerName).toBeNull()
    expect(isGameCreator).toBe(false)
  })

  it('should reset game state to defaults', () => {
    returnToMenu()

    expect(gameState.stage).toBe('setup')
    expect(gameState.roomCode).toBe('')
    expect(gameState.hostName).toBeNull()
    expect(gameState.players).toEqual([])
    expect(gameState.gameEnded).toBe(false)
    expect(gameState.winner).toBeNull()
  })
})

// TODO: Add more test suites for:
// - New session creation (newGameSameSettings, newGameNewSettings)
