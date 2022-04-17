/* eslint-env jasmine */
/**
 * @fileoverview Tests for the Controllers class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const crypto = require('crypto')
const Controllers = require('../../lib/controllers/controllers')
const MockLoggers = require('../mocks/internal/mock-loggers')
const MockHttpRequest = require('../mocks/external/mock-http-request')
const MockHttpResponse = require('../mocks/external/mock-http-response')

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
    it('should take no arguments', () => {
      const thisShouldNotThrow = () => {
        ctlrs.gameAuth('Foo')
      }

      expect(ctlrs.gameAuth).toBeInstanceOf(Function)
      expect(ctlrs.gameAuth.length).toBe(0)
      expect(thisShouldNotThrow).not.toThrow()
    })

    it('should return an async function that takes two parameters', () => {
      const AsyncFunction = Object.getPrototypeOf(async () => { }).constructor
      expect(ctlrs.gameAuth()).toBeInstanceOf(Function)
      expect(ctlrs.gameAuth()).toBeInstanceOf(AsyncFunction)
      expect(ctlrs.gameAuth().length).toBe(2)
    })

    it('should return an error if no query is given', done => {
      const mockReq = new MockHttpRequest({
        url: '/game-auth/get',
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      ctlrs.gameAuth()(mockReq, mockRes)

      setTimeout(() => {
        expect(mockRes.statusCode).toBe(400)
        expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
          status: 'error',
          error: { message: 'Query string is required!' }
        })
        done()
      }, 100)
    })

    it('should return an error if query does not include required fields', done => {
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?player=${encodeURIComponent('[object Object]')}`,
        query: new URLSearchParams(`?player=${encodeURIComponent('[object Object]')}`),
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()

      ctlrs.gameAuth()(mockReq, mockRes)

      setTimeout(() => {
        expect(mockRes.statusCode).toBe(400)
        expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
          status: 'error',
          error: { message: 'Query string missing fields.' }
        })
        done()
      }, 100)
    })

    it('should return the SHA-256 HMAC of the passed-in fields', async () => {
      const data = {
        playerName: 'NOPE',
        playerTeam: 'Franch',
        playerGame: '7H3_B357_G4M3_0N_7H15_53RV3R'
      }
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(data).map(entry => [entry[0].toLowerCase(), entry[1]])
        ))
      const mockReq = new MockHttpRequest({
        url: `/game-auth/get?${query.toString()}`,
        query: query,
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()
      const unexpectedHmac = crypto.createHmac('sha256', 'game-auth-secret')
        .update(JSON.stringify(data))
        .digest()
        .toString('hex')

      await ctlrs.gameAuth()(mockReq, mockRes)

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
