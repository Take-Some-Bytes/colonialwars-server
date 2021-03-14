/* eslint-env jasmine */
/**
 * @fileoverview Specs for the Manager class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const path = require('path')
const events = require('events')

const Player = require('../lib/game/player')
const Manager = require('../lib/game/manager')
const GameLoader = require('../lib/game/gameloader')
const TeamGame = require('../lib/game/game-modes/team-game')

const MockLoggers = require('./mocks/internal/mock-loggers')
const MockSocket = require('./mocks/external/mock-io-socket')

const communications = {
  SOCKET_UPDATE: 'mock-game-update',
  SOCKET_REMOVE_PLAYER: 'mock-game-remove-player'
}

describe('The Manager class,', () => {
  const gameLoader = new GameLoader({
    baseDir: path.join(__dirname, 'mocks/external/mock-game-confs'),
    debug: (...args) => {
      process.stdout.write(Buffer.from(`DEBUG: ${args.join(' ')}\r\n`))
    },
    loggers: new MockLoggers(),
    gameConstants: {
      communications: communications,
      playerStats: {
        PLAYER_SPEED: 0.4
      }
    }
  })
  let manager = null

  it('should construct without error', () => {
    let err = null

    try {
      manager = new Manager({
        maxGames: 2,
        startGames: 1,
        loggers: new MockLoggers(),
        gameConfs: [
          'valid-config.json',
          'valid-config-2.json'
        ],
        gameLoader: gameLoader,
        updateLoopFrequency: 40
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(manager).toBeInstanceOf(Manager)
  })

  describe('The .init() method', () => {
    it('should add the number of games specified with the .startGames property', async () => {
      let createdGame = null
      let err = null

      try {
        if (manager instanceof Manager) {
          await manager.init()
          createdGame = manager.games.get('game-1')
        }
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(manager.games.size).toBe(1)
      expect(createdGame).toBeInstanceOf(TeamGame)
    })
  })

  describe('The .newRandomGame() method', () => {
    it('should create a new, random game selected from the list of available configs', async () => {
      let createdGame = null
      let err = null

      try {
        if (manager instanceof Manager) {
          createdGame = await manager.newRandomGame()
        }
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(manager.games.size).toBe(2)
      expect(createdGame).toBeInstanceOf(TeamGame)
    })

    it('should reject if maximum number of games has been reached', async () => {
      let createdGame = null
      let err = null

      try {
        if (manager instanceof Manager) {
          createdGame = await manager.newRandomGame()
        }
      } catch (ex) {
        err = ex
      }

      expect(createdGame).toBe(null)
      expect(manager.games.size).toBe(2)
      expect(err).toBeInstanceOf(RangeError)
    })
  })

  describe('The .addClientToGame() method,', () => {
    it('should be able to add clients to a specific game if it has space', () => {
      const players = [
        { meta: { name: 'GENERAL LOUDSPEAKER', team: 'one' }, socket: MockSocket.create() },
        { meta: { name: 'THISISTHEPOLICE', team: 'two' }, socket: MockSocket.create() },
        { meta: { name: 'socialsecurity', team: 'one' }, socket: MockSocket.create() },
        { meta: { name: 'FBIOPENUP', team: 'two' }, socket: MockSocket.create() }
      ]
      const gameID = 'game-1'
      let game = null
      let err = null

      try {
        if (manager instanceof Manager) {
          for (const player of players) {
            manager.addClientToGame(gameID, player.socket, player.meta)
          }
          game = manager.getGame(gameID)
        }
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(game).toBeInstanceOf(TeamGame)
      expect(game.players.size).toBe(4)
      expect(Array.from(game.players.values()).every(val => val instanceof Player))
    })

    it('should not be able to add clients to a specific game if it has no space', () => {
      const player = {
        meta: {
          name: 'Let me in please!',
          team: 'two'
        },
        socket: MockSocket.create()
      }
      const gameID = 'game-1'
      let game = null
      let err = null

      try {
        if (manager instanceof Manager) {
          manager.addClientToGame(gameID, player.socket, player.meta)
          game = manager.getGame(gameID)
        }
      } catch (ex) {
        err = ex
      }

      expect(game).toBe(null)
      expect(err).toBeInstanceOf(RangeError)
      expect(err.message).toBe('Could not add player. Game is either full or closed.')
    })
  })

  it('should be able to start the update loop', done => {
    /**
     * @type {Array<jasmine.Spy<import('../lib/game/game-modes/base-game')['prototype']['update']>>}
     */
    const spies = []
    const doneEmitter = new events.EventEmitter()
    let calls = 0
    doneEmitter.on('updated', () => {
      if (calls > 1) {
        expect(calls).toBe(2)
        expect(manager.updateLoop.ref).toBeInstanceOf(Function)
        expect(manager.updateLoop.unref).toBeInstanceOf(Function)
        expect(spies.length).toBe(2)
        spies.forEach(spy => {
          expect(spy).toHaveBeenCalledTimes(1)
          expect(spy.calls.all().length).toBe(1)
          expect(spy.calls.argsFor(0).length).toBe(0)
        })
        done()
      }
    })

    if (manager instanceof Manager) {
      const games = Array.from(manager.games.entries())
      manager.games = new Map(games.map((entry, i) => {
        const spy = jasmine.createSpy('Game .update() method spy', entry[1].update).and.callFake(() => {
          calls++
          manager.games.set(entry[0], games[i][1])
          doneEmitter.emit('updated')
        })
        entry[1].update = spy
        spies.push(spy)
        return [entry[0], entry[1]]
      }))
      manager.startUpdateLoop()
    }
  })

  it('should be able to stop the update loop', () => {
    if (manager instanceof Manager) {
      manager.stopUpdateLoop()
      expect(manager.updateLoop).toBe(null)
    }
  })
})
