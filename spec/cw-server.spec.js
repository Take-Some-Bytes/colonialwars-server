/* eslint-env jasmine */
/**
 * @fileoverview Tests for the CWServer class.
 */

const http = require('http')
const Router = require('router')

const CWServer = require('../')
const GameServer = require('../lib/game-server')
const Manager = require('../lib/game/manager')
const Loggers = require('../lib/logging/loggers')
const GameLoader = require('../lib/game/gameloader')
const ServerUtils = require('../lib/utils/server-utils')
const Middlewares = require('../lib/controllers/middlewares')
const Controllers = require('../lib/controllers/controllers')
const Configurations = require('../lib/utils/configurations')

const fetch = require('./helpers/fetch')

describe('The CWServer class,', () => {
  // Set PORT to 1487 to avoid clashing with other processes.
  process.env.PORT = 1487
  let cwServer = null

  it('should construct and initialize without error', async () => {
    let err = null
    try {
      cwServer = await CWServer.create()
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(cwServer).toBeInstanceOf(CWServer)
  })

  it('should have the proper configuration object', () => {
    let configurationObj = null
    if (cwServer instanceof CWServer) {
      configurationObj = cwServer.config
    }
    expect(configurationObj).toBeInstanceOf(Configurations)
  })

  it('should have the proper helper classes', () => {
    const obj = {}
    if (cwServer instanceof CWServer) {
      obj.loggers = cwServer.loggers
      obj.manager = cwServer.manager
      obj.gameloader = cwServer.gameloader
      obj.serverUtils = cwServer.serverUtils
      obj.middlewares = cwServer.middlewares
      obj.controllers = cwServer.controllers
    }
    expect(obj.loggers).toBeInstanceOf(Loggers)
    expect(obj.manager).toBeInstanceOf(Manager)
    expect(obj.gameloader).toBeInstanceOf(GameLoader)
    expect(obj.serverUtils).toBeInstanceOf(ServerUtils)
    expect(obj.middlewares).toBeInstanceOf(Middlewares)
    expect(obj.controllers).toBeInstanceOf(Controllers)
  })

  it('should have a Router, HTTP server, and GameServer object', () => {
    let httpServer = null
    let gameServer = null
    let routerObj = null
    if (cwServer instanceof CWServer) {
      gameServer = cwServer.gameServer
      httpServer = cwServer.httpServer
      routerObj = cwServer.router
    }

    expect(httpServer).toBeInstanceOf(http.Server)
    expect(gameServer).toBeInstanceOf(GameServer)
    expect(routerObj).toBeInstanceOf(Router)
  })

  describe('when starting and stopping,', () => {
    it('should start at the specified port', async () => {
      if (cwServer instanceof CWServer) {
        await cwServer.start()
      }

      const serverRes = await fetch('http://localhost:1487/status-report')
      expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
      expect(serverRes.meta.statusCode).toBe(200)
      expect(serverRes.body).toBeInstanceOf(Buffer)
      expect(JSON.parse(serverRes.body.toString('utf-8')).data.serverRunning)
        .toBeTrue()
    })
  })

  it('should be able to stop when requested', async () => {
    let err = null
    if (cwServer instanceof CWServer) {
      await cwServer.stop()
    }

    try {
      await fetch('http://localhost:1487/status-report')
    } catch (ex) {
      err = ex
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('ECONNREFUSED')
    expect(err.syscall).toBe('connect')
  })
})
