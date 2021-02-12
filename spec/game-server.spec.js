/* eslint-env jasmine */
/**
 * @fileoverview Tests for the GameServer class.
 */

const http = require('http')
const Router = require('router')

const GameServer = require('../')
const Loggers = require('../lib/logging/loggers')
const GameLoader = require('../lib/game/gameloader')
const ServerUtils = require('../lib/utils/server-utils')
const Middlewares = require('../lib/controllers/middlewares')
const Controllers = require('../lib/controllers/controllers')
const Configurations = require('../lib/utils/configurations')

const fetch = require('./helpers/fetch')

describe('The GameServer class,', () => {
  // Set PORT to 1487 to avoid clashing with other processes.
  process.env.PORT = 1487
  let gameServer = null

  it('should construct and initialize without error', async () => {
    let err = null
    try {
      gameServer = await GameServer.create()
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(gameServer).toBeInstanceOf(GameServer)
  })

  it('should have the proper configuration object', () => {
    let configurationObj = null
    if (gameServer instanceof GameServer) {
      configurationObj = gameServer.config
    }
    expect(configurationObj).toBeInstanceOf(Configurations)
  })

  it('should have the proper helper classes', () => {
    const obj = {}
    if (gameServer instanceof GameServer) {
      obj.loggers = gameServer.loggers
      obj.gameloader = gameServer.gameloader
      obj.serverUtils = gameServer.serverUtils
      obj.middlewares = gameServer.middlewares
      obj.controllers = gameServer.controllers
    }
    expect(obj.loggers).toBeInstanceOf(Loggers)
    expect(obj.gameloader).toBeInstanceOf(GameLoader)
    expect(obj.serverUtils).toBeInstanceOf(ServerUtils)
    expect(obj.middlewares).toBeInstanceOf(Middlewares)
    expect(obj.controllers).toBeInstanceOf(Controllers)
  })

  it('should have a Router object and a HTTP server instance', () => {
    let httpServer = null
    let routerObj = null
    if (gameServer instanceof GameServer) {
      httpServer = gameServer.server
      routerObj = gameServer.router
    }
    expect(httpServer).toBeInstanceOf(http.Server)
    expect(routerObj).toBeInstanceOf(Router)
  })
})

describe('The GameServer class, when handling requests,', () => {
  const oldProcessTitle = process.title
  let gameServer = null

  beforeAll(async () => {
    // Set the process title... just because.
    process.title = 'colonialwars-gameserver'
    gameServer = await GameServer.create()
    console.log()
    await gameServer.start()
  })
  afterAll(async () => {
    // And then... reset it.
    process.title = oldProcessTitle
    if (gameServer instanceof GameServer) {
      await gameServer.stop()
    }
  })

  it('should respond to requests at /testing', async () => {
    const serverRes = await fetch('http://localhost:1487/testing')

    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(200)
    expect(serverRes.body).toBeInstanceOf(Buffer)
  })
})
