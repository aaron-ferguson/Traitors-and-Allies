import { beforeEach, afterEach, vi } from 'vitest'

// Mock browser globals that exist in browser but not in Node.js test environment
global.alert = vi.fn()
global.confirm = vi.fn(() => true)
global.prompt = vi.fn()

// Mock Vibration API
global.navigator = global.navigator || {}
global.navigator.vibrate = vi.fn()

// Mock Supabase global object (loaded via CDN in browser)
global.supabase = {
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      delete: vi.fn(() => ({ eq: vi.fn() }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn(function() { return this }),
      subscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }))
}

// Mock console methods to reduce noise (optional)
// global.console = {
//   ...console,
//   log: vi.fn(),
//   warn: vi.fn(),
// }

// Store original gameState for restoration between tests
let originalGameState

beforeEach(() => {
  // Save a deep copy of gameState if it exists
  if (typeof globalThis.gameState !== 'undefined') {
    originalGameState = JSON.parse(JSON.stringify(globalThis.gameState))
  }

  // Clear DOM before each test
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = ''
  }
})

afterEach(() => {
  // Restore original gameState to prevent test interference
  if (originalGameState && typeof globalThis.gameState !== 'undefined') {
    Object.assign(globalThis.gameState, originalGameState)
  }

  // Clear all mock function calls and instances
  vi.clearAllMocks()
})
