/* eslint-env jasmine */
/**
 * @fileoverview Tests for the CWServer class.
 */

const http = require('http')
const Router = require('router')

const CWServer = require('../')
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

  it('should have a Router object and a HTTP server instance', () => {
    let httpServer = null
    let routerObj = null
    if (cwServer instanceof CWServer) {
      httpServer = cwServer.server
      routerObj = cwServer.router
    }
    expect(httpServer).toBeInstanceOf(http.Server)
    expect(routerObj).toBeInstanceOf(Router)
  })
})

describe('The CWServer class, when handling requests,', () => {
  const oldProcessTitle = process.title
  let cwServer = null

  beforeAll(async () => {
    // Set the process title... just because.
    process.title = 'colonialwars-gameserver'
    cwServer = await CWServer.create()
    console.log()
    await cwServer.start()
  })
  afterAll(async () => {
    // And then... reset it.
    process.title = oldProcessTitle
    if (cwServer instanceof CWServer) {
      await cwServer.stop()
    }
  })

  it('should respond to requests at /testing', async () => {
    const serverRes = await fetch('http://localhost:1487/testing')

    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(200)
    expect(serverRes.body).toBeInstanceOf(Buffer)
  })
})
