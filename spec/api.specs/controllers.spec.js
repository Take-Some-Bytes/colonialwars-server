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

  afterEach(() => mockDB.clear())

  it('should have 4 methods for handling routes', () => {
    const ctlrs = createCtlrs(mockDB)

    expect(ctlrs.statusReport).toBeInstanceOf(Function)
    expect(ctlrs.gamesInfo).toBeInstanceOf(Function)
    expect(ctlrs.gameAuth).toBeInstanceOf(Function)
    expect(ctlrs.unhandled).toBeInstanceOf(Function)
  })

  it('should have an endpoint that details the server status', () => {
    const ctlrs = createCtlrs(mockDB)
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

  it('should have an endpoint that handles all unhandled routes', () => {
    const ctlrs = createCtlrs(mockDB)
    const mockReq = new MockHttpRequest({ id: '10', url: '/404' })
    const mockRes = new MockHttpResponse()
    let logged = false

    // Feature of the MockLoggers class.
    ctlrs.loggers.on('log', () => {
      logged = true
    })

    ctlrs.unhandled()(mockReq, mockRes)

    expect(logged).toBeTrue()
    expect(mockRes.statusCode).toBe(404)
    expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
      status: 'error',
      error: {
        message: '404 Not Found'
      }
    })
  })

  describe('the /games-info handler,', () => {
    afterEach(() => mockDB.clear())

    it('should send an array listing the games that are hosted', () => {
      const ctlrs = createCtlrs(mockDB)
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

    it('should send games even if they are full', () => {
      const ctlrs = createCtlrs(mockDB)
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
            currentPlayers: 12
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
            current: 12
          }
        }]
      })
    })
  })

  describe('the /game-auth handler,', () => {
    afterEach(() => mockDB.clear())

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
})
