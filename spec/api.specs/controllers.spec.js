/* eslint-env jasmine */
/**
 * @fileoverview Tests for the Controllers class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const crypto = require('crypto')

const MockGame = require('../mocks/internal/mock-game')
const MockLoggers = require('../mocks/internal/mock-loggers')
const MockManager = require('../mocks/internal/mock-manager')
const MockHttpRequest = require('../mocks/external/mock-http-request')
const MockHttpResponse = require('../mocks/external/mock-http-response')

const Controllers = require('../../lib/controllers/controllers')

const SPEC_SECRET = 'very secrety'

/**
 * Creates a controllers instance for specs.
 * @param {import('../../lib/controllers/controllers').IStringDB} db The auth DB.
 * @returns {Controllers}
 */
function createCtlrs (db) {
  return new Controllers({
    gameAuthSecret: SPEC_SECRET,
    authDB: db,
    loggers: new MockLoggers()
  })
}
/**
 * Creates a URLSearchParams object with the specified parameters
 * @param {string} name The name of the player.
 * @param {string} team The team to join.
 * @param {string} game The game ID.
 * @returns {URLSearchParams}
 */
function createQueryWith (name, team, game) {
  return new URLSearchParams({
    playername: name,
    playerteam: team,
    playergame: game
  })
}

describe('The Controllers class,', () => {
  const mockDB = new Map()
  mockDB.del = mockDB.delete
  let ctlrs = null

  it('should construct without error', () => {
    let e = null

    try {
      ctlrs = new Controllers({
        gameAuthSecret: 'very secrety',
        authDB: mockDB,
        loggers: new MockLoggers()
      })
    } catch (ex) {
      e = ex
    }

    expect(e).toBeNull()
    expect(ctlrs).toBeInstanceOf(Controllers)
  })

  it('should have 4 methods for handling routes', () => {
    expect(ctlrs.statusReport).toBeInstanceOf(Function)
    expect(ctlrs.gamesInfo).toBeInstanceOf(Function)
    expect(ctlrs.gameAuth).toBeInstanceOf(Function)
    expect(ctlrs.unhandled).toBeInstanceOf(Function)
  })

  describe('the /status-report handler,', () => {
    it('should take one argument that must be an object with a getStatus method', () => {
      const thisShouldThrow = () => {
        ctlrs.statusReport('I am not a status reporter')
      }
      const thisShouldNotThrow = () => {
        ctlrs.statusReport({ getStatus () { return 'Status!' } })
      }

      expect(ctlrs.statusReport).toBeInstanceOf(Function)
      expect(ctlrs.statusReport.length).toBe(1)
      expect(thisShouldThrow).toThrowError(TypeError)
      expect(thisShouldNotThrow).not.toThrowError(TypeError)
    })

    it('should return a function that takes two parameters', () => {
      const statusReporter = { getStatus () { return 'Status!' } }
      expect(ctlrs.statusReport(statusReporter)).toBeInstanceOf(Function)
      expect(ctlrs.statusReport(statusReporter).length).toBe(2)
    })

    it('should send an object detailing the server status', () => {
      const mockRes = new MockHttpResponse()
      const reporter = {
        getStatus () {
          return {
            running: true,
            full: false,
            capacity: { maxClients: 10, currentClients: 1 }
          }
        }
      }

      ctlrs.statusReport(reporter)(null, mockRes)

      expect(mockRes.writableEnded).toBeTrue()
      expect(mockRes.statusCode).toBe(200)
      expect(Object.keys(mockRes.headers)).toHaveSize(2)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'ok',
        data: {
          serverRunning: true,
          full: false,
          maxClients: 10,
          currentClients: 1
        }
      })
    })
  })

  describe('the /games-info handler,', () => {
    it('should take one argument that must be a Manager instance', () => {
      const thisShouldThrow = () => {
        ctlrs.gamesInfo('Not a manager')
      }
      const thisShouldNotThrow = () => {
        ctlrs.gamesInfo({ availableGames: [] })
      }

      expect(ctlrs.gamesInfo).toBeInstanceOf(Function)
      expect(ctlrs.gamesInfo.length).toBe(1)
      expect(thisShouldThrow).toThrowError(TypeError)
      expect(thisShouldNotThrow).not.toThrowError(TypeError)
    })

    it('should return a function that takes two parameters', () => {
      const manager = { availableGames: [] }
      expect(ctlrs.gamesInfo(manager)).toBeInstanceOf(Function)
      expect(ctlrs.gamesInfo(manager).length).toBe(2)
    })

    it('should send an array listing the games that are hosted', () => {
      const mockRes = new MockHttpResponse()
      const definitelyAManager = {
        availableGames: [
          {
            id: 'fjfj',
            name: 'Hey there',
            mode: 'Teams',
            availableTeams: ['Rouge', 'Bleu'],
            description: 'Oi there. How ya doin',
            maxPlayers: 12,
            currentPlayers: 1
          }
        ]
      }

      ctlrs.gamesInfo(definitelyAManager)(null, mockRes)

      expect(mockRes.writableEnded).toBeTrue()
      expect(mockRes.statusCode).toBe(200)
      expect(Object.keys(mockRes.headers)).toHaveSize(2)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'ok',
        data: [{
          id: 'fjfj',
          mode: 'Teams',
          name: 'Hey there',
          teams: ['Rouge', 'Bleu'],
          description: 'Oi there. How ya doin',
          capacity: {
            max: 12,
            current: 1
          }
        }]
      })
    })
  })

  describe('the /game-auth handler,', () => {
    const mockDB = new Map()
    mockDB.del = mockDB.delete

    afterEach(() => {
      mockDB.clear()
    })

    it('should return an error if no query is given', async () => {
      const ctlrs = createCtlrs(mockDB)
      const mockReq = new MockHttpRequest({
        url: '/game-auth/get',
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      await ctlrs.gameAuth()(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(400)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Query string is required!' }
      })
    })

    it('should return an error if query does not include required fields', async () => {
      const ctlrs = createCtlrs(mockDB)
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?player=${encodeURIComponent('[object Object]')}`,
        query: new URLSearchParams(`?player=${encodeURIComponent('[object Object]')}`),
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      await ctlrs.gameAuth()(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(400)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Query string missing fields.' }
      })
    })

    it('should return an error if the player has already requested auth', async () => {
      const ctlrs = createCtlrs(mockDB)
      const query = createQueryWith('NOPE', 'Franch', '7H3_B357_G4M3_0N_7H15_53RV3R')
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      mockDB.set('NOPE', {})

      await ctlrs.gameAuth()(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(409)
      expect(mockRes.headers['Content-Type']).toBe('application/json')
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Player already exists.' }
      })
    })

    it('should return an error if the player already exists in a game', async () => {
      const ctlrs = createCtlrs(mockDB)
      const query = createQueryWith('NOPE', 'Franch', '7H3_B357_G4M3_0N_7H15_53RV3R')
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      const mockManager = new MockManager({
        existingPlayers: ['NOPE']
      })

      await ctlrs.gameAuth(mockManager)(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(409)
      expect(mockRes.headers['Content-Type']).toBe('application/json')
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Player already exists.' }
      })
    })

    it('should return an error if the game does not exist', async () => {
      const ctlrs = createCtlrs(mockDB)
      const query = createQueryWith('NOPE', 'Franch', 'no_exist')
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      const mockManager = new MockManager({
        games: new Map([['exists', {}]])
      })

      await ctlrs.gameAuth(mockManager)(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(400)
      expect(mockRes.headers['Content-Type']).toBe('application/json')
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Game not found' }
      })
    })

    it('should return an error if the game is full', async () => {
      const ctlrs = createCtlrs(mockDB)
      const query = createQueryWith('NOPE', 'Franch', 'exists')
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      const mockManager = new MockManager({
        games: new Map([
          ['game-exists', new MockGame({
            currentPlayers: 1,
            maxPlayers: 1
          })]
        ])
      })

      await ctlrs.gameAuth(mockManager)(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(400)
      expect(mockRes.headers['Content-Type']).toBe('application/json')
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Game is full' }
      })
    })

    it('should return an error if the team does not exist', async () => {
      const ctlrs = createCtlrs(mockDB)
      const query = createQueryWith('NOPE', 'Franch', 'exists')
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      const mockManager = new MockManager({
        games: new Map([
          ['game-exists', new MockGame({
            teams: [{ name: 'notfranch' }],
            currentPlayers: 0,
            maxPlayers: 1
          })]
        ])
      })

      await ctlrs.gameAuth(mockManager)(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(400)
      expect(mockRes.headers['Content-Type']).toBe('application/json')
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Team not found' }
      })
    })

    it('should return an error if the team is full', async () => {
      const ctlrs = createCtlrs(mockDB)
      const query = createQueryWith('NOPE', 'Franch', 'exists')
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      const mockManager = new MockManager({
        games: new Map([
          ['game-exists', new MockGame({
            teams: [{ name: 'Franch', maxPlayers: 1, currentPlayers: 1 }],
            currentPlayers: 0,
            maxPlayers: 1
          })]
        ])
      })

      await ctlrs.gameAuth(mockManager)(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(400)
      expect(mockRes.headers['Content-Type']).toBe('application/json')
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Team is full' }
      })
    })

    it('should return the SHA-256 HMAC of the passed-in fields', async () => {
      const ctlrs = createCtlrs(mockDB)
      const data = {
        playerName: 'NOPE',
        playerTeam: 'Franch',
        playerGame: '7H3_B357_G4M3_0N_7H15_53RV3R'
      }
      const query = createQueryWith('NOPE', 'Franch', '7H3_B357_G4M3_0N_7H15_53RV3R')
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()
      const mockManager = new MockManager({
        games: new Map([[
          'game-7H3_B357_G4M3_0N_7H15_53RV3R',
          new MockGame({
            teams: [{ name: 'Franch', maxPlayers: 1, currentPlayers: 0 }],
            currentPlayers: 0,
            maxPlayers: 1
          })
        ]])
      })
      const unexpectedHmac = crypto.createHmac('sha256', 'game-auth-secret')
        .update(JSON.stringify(data))
        .digest()
        .toString('hex')

      await ctlrs.gameAuth(mockManager)(mockReq, mockRes)

      expect(mockRes.statusCode).toBe(200)
      expect(mockRes.headers['Content-Type']).toBe('application/json')
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).not.toEqual({
        status: 'ok',
        data: {
          auth: unexpectedHmac
        }
      })
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'ok',
        data: {
          auth: JSON.parse(mockDB.get('NOPE')).auth
        }
      })
    })
  })

  describe('the handler which catches all unhandled routes,', () => {
    it('should take no arguments', () => {
      const thisShouldNotThrow = () => {
        ctlrs.unhandled('fart')
      }

      expect(ctlrs.unhandled).toBeInstanceOf(Function)
      expect(ctlrs.unhandled.length).toBe(0)
      expect(thisShouldNotThrow).not.toThrow()
    })

    it('should return a function that takes two parameters', () => {
      expect(ctlrs.unhandled()).toBeInstanceOf(Function)
      expect(ctlrs.unhandled().length).toBe(2)
    })
  })
})
