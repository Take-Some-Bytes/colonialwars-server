/* eslint-env jasmine */
/**
 * @fileoverview Tests for the Controllers class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const http = require('http')
const Router = require('router')

const Controllers = require('../lib/controllers/controllers')
const ServerUtils = require('../lib/utils/server-utils')

const fetch = require('./helpers/fetch')
const MockServerUtils = require('./mocks/internal/mock-server-utils')
const MockLoggers = require('./mocks/internal/mock-loggers')

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
