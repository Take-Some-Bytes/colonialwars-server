/* eslint-env jasmine */
/**
 * @fileoverview Specs for the Manager class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const path = require('path')
const events = require('events')

const Player = require('../../lib/game/player')
const Manager = require('../../lib/game/manager')
const Vector2D = require('../../lib/game/physics/vector-2d')
const TeamGame = require('../../lib/game/game-modes/team-game')

const MockLoggers = require('../mocks/internal/mock-loggers')
const MockSocket = require('../mocks/external/mock-io-socket')

const TEST_PLAYERS = [
  { meta: { name: 'GENERAL LOUDSPEAKER', team: 'one' }, socket: MockSocket.create() },
  { meta: { name: 'THISISTHEPOLICE', team: 'two' }, socket: MockSocket.create() },
  { meta: { name: 'socialsecurity', team: 'one' }, socket: MockSocket.create() },
  { meta: { name: 'FBIOPENUP', team: 'two' }, socket: MockSocket.create() }
]

/**
 * Initializes a manager for a spec.
 * @returns {Promise<InstanceType<Manager>>}
 */
async function initManager () {
  const manager = new Manager({
    maxGames: 2,
    startGames: 1,
    loggers: new MockLoggers(),
    updateLoopFrequency: 40,
    dataFiles: {
      location: path.join(__dirname, '../mocks/external/mock-game-confs'),
      availableMaps: ['valid-config.json']
    }
  })

  await manager.init()

  return manager
}

describe('The Manager class,', () => {
  it('should add the number of games specified with the .startGames property', async () => {
    const manager = await initManager()
    const createdGame = manager.games.get('game-1')

    expect(manager.games.size).toBe(1)
    expect(createdGame).toBeInstanceOf(TeamGame)
  })

  describe('The .newRandomGame() method', () => {
    it('should create a new, random game selected from the list of available configs', async () => {
      const manager = await initManager()
      const game = await manager.newRandomGame()

      expect(manager.games.size).toBe(2)
      expect(game).toBeInstanceOf(TeamGame)
    })

    it('should reject if maximum number of games has been reached', async () => {
      const manager = await initManager()
      await manager.newRandomGame()

      const promise = async () => {
        await manager.newRandomGame()
      }

      await expectAsync(promise()).toBeRejectedWithError(RangeError)
      expect(manager.games.size).toBe(2)
    })
  })

  describe('The .addClientTo() method,', () => {
    it('should be able to add clients to a specific game if it has space', async () => {
      const manager = await initManager()

      TEST_PLAYERS.forEach(player => manager.addClientTo('game-1', player.socket, player.meta))

      const game = manager.games.get('game-1')

      expect(game).toBeInstanceOf(TeamGame)
      expect(game.players.size).toBe(4)
      expect(Array.from(game.players.values()).every(val => val instanceof Player))
    })

    it('should not be able to add clients to a specific game if it has no space', async () => {
      const manager = await initManager()
      TEST_PLAYERS.forEach(player => manager.addClientTo('game-1', player.socket, player.meta))

      const lastPlayer = {
        meta: {
          name: 'Let me in please!',
          team: 'two'
        },
        socket: MockSocket.create()
      }

      const func = () => {
        manager.addClientTo('game-1', lastPlayer.socket, lastPlayer.meta)
      }

      expect(func).toThrowError(RangeError)
      expect(func).toThrowError('Could not add player. Game is either full or closed.')
    })
  })

  describe('after returning a game handle', () => {
    it('should be able to add players', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      expect(manager.games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)
      expect(manager.games.get('game-1').currentPlayers).toBe(handle.currentPlayers)
    })

    it('should be able to remove players', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      expect(manager.games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)
      expect(manager.games.get('game-1').currentPlayers).toBe(handle.currentPlayers)

      const playerToRemove = TEST_PLAYERS[2]
      handle.removePlayer(playerToRemove.socket)

      expect(manager.games.get('game-1').players.has(playerToRemove.socket.id)).not.toBeTrue()
      expect(manager.games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length - 1)
      expect(manager.games.get('game-1').currentPlayers).toBe(handle.currentPlayers)
    })

    it('should be able to clear all players', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      expect(manager.games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)
      expect(manager.games.get('game-1').currentPlayers).toBe(handle.currentPlayers)

      handle.clearPlayers()

      expect(manager.games.get('game-1').players.size).toBe(0)
      expect(manager.games.get('game-1').currentPlayers).toBe(0)
      expect(manager.games.get('game-1').currentPlayers).toBe(0)
    })

    it('should be able to get map data', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      const mapData = handle.getMapData()

      expect(mapData).toEqual({
        tileType: 'grass',
        worldLimits: new Vector2D(200, 200),
        static: {}
      })
    })

    it('should be able to get a player by their ID', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      const player = TEST_PLAYERS[1]

      handle.addPlayer(player.socket, player.meta)

      expect(manager.games.get('game-1').currentPlayers).toBe(1)
      expect(manager.games.get('game-1').currentPlayers).toBe(handle.currentPlayers)

      const player2 = handle.getPlayerByID(player.socket.id)

      expect(player.meta.name).toEqual(player2.name)
    })
  })

  it('should be able to start and stop the update loop', async () => {
    const manager = await initManager()
    /**
     * @type {Array<jasmine.Spy<import('../../lib/game/game-modes/base-game')['prototype']['update']>>}
     */
    const spies = []
    const doneEmitter = new events.EventEmitter()
    manager.games.forEach(game => {
      const spy = jasmine.createSpy('Game .update() method spy', game.update).and.callFake(() => {
        doneEmitter.emit('updated')
      })
      game.update = spy

      spies.push(spy)
    })

    return new Promise(resolve => {
      doneEmitter.on('updated', () => {
        expect(manager.updateLoop.ref).toBeInstanceOf(Function)
        expect(manager.updateLoop.unref).toBeInstanceOf(Function)

        spies.forEach(spy => {
          expect(spy).toHaveBeenCalledTimes(1)
          expect(spy.calls.all().length).toBe(1)
          expect(spy.calls.argsFor(0).length).toBe(0)
        })

        manager.stopUpdateLoop()

        expect(manager.updateLoop).toBeNull()

        resolve()
      })

      manager.startUpdateLoop()
    })
  })

  it('should be able to remove a client', async () => {
    const manager = await initManager()

    const player = TEST_PLAYERS[0]

    manager.addClientTo('game-1', player.socket, player.meta)

    expect(manager.games.get('game-1').currentPlayers).toBe(1)

    manager.removeClientFrom('game-1', player.socket)

    expect(manager.games.get('game-1').currentPlayers).toBe(0)
  })

  it('should be able to remove all clients from a game', async () => {
    const manager = await initManager()

    TEST_PLAYERS.forEach(player => manager.addClientTo('game-1', player.socket, player.meta))

    expect(manager.games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)

    manager.clearClientsFrom('game-1')

    expect(manager.games.get('game-1').currentPlayers).toBe(0)
  })
})
