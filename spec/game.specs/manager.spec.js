/* eslint-env jasmine */
/**
 * @fileoverview Specs for the Manager class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import url from 'url'
import path from 'path'
import events from 'events'

import Manager from '../../lib/game/manager.js'
import Vector2D from '../../lib/game/physics/vector2d.js'
import TeamGame from '../../lib/game/modes/team-game.js'

import MockLoggers from '../mocks/internal/mock-loggers.js'
import MockSocket from '../mocks/external/mock-io-socket.js'

const DIRNAME = path.dirname(url.fileURLToPath(import.meta.url))
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
      location: path.join(DIRNAME, '../mocks/external/mock-game-confs'),
      availableMaps: ['valid-config.json']
    }
  })

  await manager.init()

  return manager
}

describe('The Manager class,', () => {
  it('should add the number of games specified with the .startGames property', async () => {
    const manager = await initManager()
    const createdGame = manager._games.get('game-1')

    expect(manager._games.size).toBe(1)
    expect(createdGame).toBeInstanceOf(TeamGame)
  })

  it('should be able to return all running games', async () => {
    const manager = await initManager()

    expect(manager.games).toHaveSize(manager._games.size)

    // "All running games" include games which aren't accepting players.
    manager._games.get('game-1').closed = true

    expect(manager.games).toHaveSize(manager._games.size)
  })

  describe('The .newRandomGame() method,', () => {
    it('should create a new, random game selected from the list of available configs', async () => {
      const manager = await initManager()
      const game = await manager.newRandomGame()

      expect(manager._games.size).toBe(2)
      expect(game).toBeInstanceOf(TeamGame)
    })

    it('should reject if maximum number of games has been reached', async () => {
      const manager = await initManager()
      await manager.newRandomGame()

      const promise = async () => {
        await manager.newRandomGame()
      }

      await expectAsync(promise()).toBeRejectedWithError(RangeError)
      expect(manager._games.size).toBe(2)
    })
  })

  describe('The .addClientTo() method,', () => {
    it('should be able to add clients to a specific game if it has space', async () => {
      const manager = await initManager()

      TEST_PLAYERS.forEach(player => manager.addClientTo('game-1', player.socket, player.meta))

      const game = manager._games.get('game-1')

      expect(game).toBeInstanceOf(TeamGame)
      expect(game.currentPlayers).toBe(4)
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

  describe('after returning a game handle,', () => {
    it('should be able to return basic map info', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')
      const info = handle.getInfo()

      expect(info.id).toBe(1)
      expect(info.name).toBe('Mock Game')
      expect(info.mode).toBe('teams')
      expect(info.description).toBe('This is the first mock game config.')
    })

    it('should be able to get info about teams', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')
      const teams = handle.getTeams()

      expect(teams).toHaveSize(manager._games.get('game-1').teams.size)
      expect(teams[0].name).toBe('one')
      expect(teams[1].name).toBe('two')
      expect(teams[0].full).toBeFalse()
      expect(teams[1].full).toBeFalse()
    })

    it('should be able to add players', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      expect(manager._games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)
      expect(manager._games.get('game-1').currentPlayers).toBe(handle.currentPlayers)
    })

    it('should be able to remove players', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      expect(manager._games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)
      expect(manager._games.get('game-1').currentPlayers).toBe(handle.currentPlayers)

      const playerToRemove = TEST_PLAYERS[2]
      handle.removePlayer(playerToRemove.socket)

      expect(manager._games.get('game-1').getPlayerNameByID(playerToRemove.socket.id)).toBeFalsy()
      expect(manager._games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length - 1)
      expect(manager._games.get('game-1').currentPlayers).toBe(handle.currentPlayers)
    })

    it('should be able to clear all players', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      expect(manager._games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)
      expect(manager._games.get('game-1').currentPlayers).toBe(handle.currentPlayers)

      handle.clearPlayers()

      expect(manager._games.get('game-1').currentPlayers).toBe(0)
      expect(manager._games.get('game-1').currentPlayers).toBe(handle.currentPlayers)
    })

    it('should correctly return number of players and max players', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      expect(handle.maxPlayers).toBe(4)
      expect(handle.currentPlayers).toBe(0)

      handle.addPlayer(TEST_PLAYERS[0].socket, TEST_PLAYERS[0].meta)

      expect(handle.currentPlayers).toBe(1)
    })

    it('should be able to test if a team exists', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      expect(handle.hasTeam('one')).toBeTrue()
      expect(handle.hasTeam('three')).toBeFalse()
    })

    it('should be able to test if a team is full', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      expect(handle.teamFull('one')).toBeFalse()
      expect(handle.teamFull('two')).toBeFalse()

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      expect(handle.teamFull('one')).toBeTrue()
      expect(handle.teamFull('two')).toBeTrue()

      handle.clearPlayers()

      expect(handle.teamFull('one')).toBeFalse()
      expect(handle.teamFull('two')).toBeFalse()
    })

    it('should be able to get all teams and whether they are full', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      let teams = handle.getTeams()
      expect(teams).toHaveSize(2)
      expect(teams[0].name).toBe('one')
      expect(teams[1].name).toBe('two')
      expect(teams.every(t => t.full)).toBeFalse()

      TEST_PLAYERS.forEach(player => handle.addPlayer(player.socket, player.meta))

      teams = handle.getTeams()
      expect(teams.every(t => t.full)).toBeTrue()

      handle.removePlayer(TEST_PLAYERS[3].socket)

      teams = handle.getTeams()
      expect(teams.every(t => t.full)).toBeFalse()
    })

    it('should be able to get map data', async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')

      const mapData = handle.getMapData()

      expect(mapData).toEqual({
        obstacles: [],
        decorations: [],
        tileType: 'grass',
        worldLimits: new Vector2D(200, 200)
      })
    })

    it("should be able to add input to a player's input queue", async () => {
      const manager = await initManager()
      const handle = manager.getGame('game-1')
      const player = TEST_PLAYERS[1]

      handle.addPlayer(player.socket, player.meta)

      const spy = spyOn(
        manager._games.get('game-1'),
        'addInputTo'
      ).and.callFake((..._args) => {})

      handle.addInputTo(player.socket.id, { up: true })

      expect(spy).toHaveBeenCalledWith(player.socket.id, { up: true })
    })
  })

  it('should be able to start and stop the update loop', async () => {
    const manager = await initManager()
    /**
     * @type {Array<jasmine.Spy<import('../../lib/game/modes/base-game')['prototype']['update']>>}
     */
    const spies = []
    const doneEmitter = new events.EventEmitter()
    manager._games.forEach(game => {
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

    expect(manager._games.get('game-1').currentPlayers).toBe(1)

    manager.removeClientFrom('game-1', player.socket)

    expect(manager._games.get('game-1').currentPlayers).toBe(0)
  })

  it('should be able to remove all clients from a game', async () => {
    const manager = await initManager()

    TEST_PLAYERS.forEach(player => manager.addClientTo('game-1', player.socket, player.meta))

    expect(manager._games.get('game-1').currentPlayers).toBe(TEST_PLAYERS.length)

    manager.clearClientsFrom('game-1')

    expect(manager._games.get('game-1').currentPlayers).toBe(0)
  })
})
