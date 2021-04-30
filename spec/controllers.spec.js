/* eslint-env jasmine */
/**
 * @fileoverview Tests for the Controllers class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const http = require('http')
const crypto = require('crypto')
const Router = require('router')
const qs = require('querystring')

const Controllers = require('../lib/controllers/controllers')
const ServerUtils = require('../lib/utils/server-utils')

const fetch = require('./helpers/fetch')
const MockServerUtils = require('./mocks/internal/mock-server-utils')
const MockLoggers = require('./mocks/internal/mock-loggers')
const MockRequest = require('./mocks/external/mock-http-request')
const MockResponse = require('./mocks/external/mock-http-response')

describe('The Controllers class,', () => {
  const serverUtils = new ServerUtils({
    loggers: new MockLoggers(),
    debug: (...args) => {
      console.log(`DEBUG: ${args.join(' ')}`)
    }
  })
  const router = new Router()
  const controllers = new Controllers({
    isProd: false,
    serverUtils: serverUtils
  })
  const server = http.createServer((req, res) => {
    router(req, res, (err) => {
      if (err) throw err
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain')
      res.end('Not Found')
    })
  })

  beforeAll(done => {
    server.listen(7777, err => {
      if (err) throw err
      done()
    })
  })
  afterAll(done => {
    server.close(err => {
      if (err) throw err
      done()
    })
  })

  it('should be able to register status report route', async () => {
    controllers.registerStatusRoute(router, {
      getStatus () {
        return {
          running: true,
          full: false,
          capacity: {
            maxClients: 10,
            currentClients: 1
          }
        }
      }
    })
    expect(router.stack.length).toBe(1)

    const serverRes = await fetch('http://localhost:7777/status-report')
    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(200)
    expect(serverRes.meta.headers['content-type']).toBe('application/json')
    expect(serverRes.body).toBeInstanceOf(Buffer)
    expect(JSON.parse(serverRes.body.toString('utf-8'))).toEqual({
      status: 'ok',
      data: {
        serverRunning: true,
        full: false,
        maxClients: 10,
        currentClients: 1
      }
    })
  })

  it('should send an error for non-existent routes', async () => {
    controllers.handleUnhandled(router)
    console.log()
    const serverRes = await fetch('http://localhost:7777/i-dont-exist-still')

    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(404)
    expect(serverRes.meta.headers['content-type']).toBe('application/json')
    expect(serverRes.body).toBeInstanceOf(Buffer)
    expect(JSON.parse(serverRes.body.toString('utf-8'))).toEqual({
      status: 'error',
      error: {
        message: '404 Resource Not Found.'
      }
    })
  })
})

describe('The controllers.registerTestRoute() method,', () => {
  const serverUtils = new MockServerUtils()
  const prodCtlrs = new Controllers({
    isProd: true,
    serverUtils: serverUtils
  })
  const devCtlrs = new Controllers({
    isProd: false,
    serverUtils: serverUtils
  })
  const prodRouter = new Router()
  const devRouter = new Router()
  const devServer = http.createServer((req, res) => {
    devRouter(req, res, (err) => {
      if (err) throw err
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain')
      res.end('Not Found')
    })
  })
  const prodServer = http.createServer((req, res) => {
    prodRouter(req, res, (err) => {
      if (err) throw err
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain')
      res.end('Not Found')
    })
  })
  beforeAll(done => {
    prodServer.listen(7778, err => {
      if (err) throw err
      devServer.listen(7779, err2 => {
        if (err2) throw err2
        done()
      })
    })
  })
  afterAll(done => {
    prodServer.close(err => {
      if (err) throw err
      devServer.close(err2 => {
        if (err2) throw err2
        done()
      })
    })
  })

  it('should register /testing when in dev mode', async () => {
    devCtlrs.registerTestRoute(devRouter)

    const serverRes = await fetch('http://localhost:7779/testing')

    expect(devRouter.stack.length).toBe(1)
    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(200)
    expect(serverRes.body).toBeInstanceOf(Buffer)
    expect(serverRes.body.toString('utf-8')).toBe('200 OK')
  })

  it('should not register /testing when in prod mode', async () => {
    prodCtlrs.registerTestRoute(prodRouter)

    const serverRes = await fetch('http://localhost:7778/testing')

    expect(prodRouter.stack.length).toBe(0)
    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(404)
    expect(serverRes.body).toBeInstanceOf(Buffer)
    expect(serverRes.body.toString('utf-8')).toBe('Not Found')
  })
})

describe('The /game-auth route,', () => {
  const mockServerUtils = new MockServerUtils()
  const mockAuthDB = {
    /**
     * @type {Map<string, string>}
     */
    _store: new Map(),
    get: async function (key) {
      return this._store.get(key)
    },
    set: async function (key, val) {
      this._store.set(key, val)
    },
    has: async function (key) {
      return this._store.has(key)
    },
    del: async function (key) {
      return this._store.delete(key)
    }
  }
  const ctlrs = new Controllers({
    gameAuthSecret: 'game-auth-secret',
    authDB: mockAuthDB,
    serverUtils: mockServerUtils
  })
  const router = Router()

  beforeAll(() => {
    router.use((req, res, next) => {
      const url = new URL(req.url, 'http://example.com')
      req.query = url.searchParams
      next()
    })
    router.use('/game-auth', ctlrs.gameAuthRouter())
  })

  describe('the /get endpoint,', () => {
    it('should return an error if no query is given', done => {
      const mockReq = new MockRequest({
        url: '/game-auth/get',
        method: 'GET'
      })

      router(mockReq, null, () => {
        done.fail(new Error('Route not handled'))
      })

      setTimeout(() => {
        expect(mockServerUtils.numErrorsSent).toBe(1)
        expect(mockServerUtils.errors['Error-1'].error.httpOpts.status).toBe(400)
        done()
      }, 100)
    })

    it('should return an error if query does not include required fields', done => {
      const mockReq = new MockRequest({
        url: `/game-auth/get?player=${encodeURIComponent('[object Object]')}`,
        method: 'GET'
      })

      router(mockReq, null, () => {
        done.fail(new Error('Route not handled'))
      })

      setTimeout(() => {
        expect(mockServerUtils.numErrorsSent).toBe(2)
        expect(mockServerUtils.errors['Error-2'].error.httpOpts.status).toBe(400)
        done()
      }, 100)
    })

    it('should return the SHA-256 HMAC of the passed-in fields', done => {
      const data = {
        playerName: 'NOPE',
        playerTeam: 'Franch',
        playerGame: '7H3_B357_G4M3_0N_7H15_53RV3R'
      }
      const mockReq = new MockRequest({
        url: `/game-auth/get?${qs.stringify(
          Object.fromEntries(
            Object.entries(data).map(entry => [entry[0].toLowerCase(), entry[1]])
          ))}`,
        method: 'GET'
      })
      const mockRes = new MockResponse()
      const unexpectedHmac = crypto.createHmac('sha256', 'game-auth-secret')
        .update(JSON.stringify(data))
        .digest()
        .toString('hex')

      router(mockReq, mockRes, () => {
        done.fail(new Error('Route not handled'))
      })

      setTimeout(async () => {
        expect(mockServerUtils.numErrorsSent).toBe(2)
        expect(mockServerUtils.errors['Error-3']).toBe(undefined)
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
            auth: JSON.parse(await mockAuthDB.get('NOPE')).auth
          }
        })
        done()
      }, 100)
    })
  })
})
