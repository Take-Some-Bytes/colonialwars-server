/* eslint-env jasmine */
/**
 * @fileoverview Specs for the BaseGame class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const nanoid = require('nanoid')

const Vector2D = require('../../lib/game/physics/vector-2d')
const { BaseGame } = require('../../lib/game/game-modes')

const TESTING_PLAYERS = [
  { meta: { name: 'GENERAL LOUDSPEAKER', team: 'one' }, id: nanoid.nanoid() },
  { meta: { name: 'THISISTHEPOLICE', team: 'two' }, id: nanoid.nanoid() },
  { meta: { name: 'socialsecurity', team: 'one' }, id: nanoid.nanoid() },
  { meta: { name: 'FBIOPENUP', team: 'two' }, id: nanoid.nanoid() }
]

/**
 * Creates a BaseGame instance for testing.
 * @returns {BaseGame}
 */
function createBaseGame () {
  const game = new BaseGame({
    id: 'V3RY-UN1QU3-1D',
    mapConfig: {
      mapName: 'Base Game 1',
      mode: 'Teams',
      maxPlayers: 4,
      description: 'Testing this game.',
      worldLimits: { x: 200, y: 200 },
      teams: [
        {
          name: 'one',
          spawnPosition: new Vector2D(0, 0),
          description: 'Team one.',
          maxPlayers: 2
        },
        {
          name: 'two',
          spawnPosition: new Vector2D(200, 200),
          description: 'Team two.',
          maxPlayers: 2
        }
      ],
      tileType: 'grass',
      player: {
        speed: 0.4
      }
    }
  })
  game.init()

  return game
}

describe('The BaseGame class,', () => {
  describe('The .addPlayer() method,', () => {
    it('should be able to add new players when space is available', () => {
      const baseGame = createBaseGame()

      TESTING_PLAYERS.slice(0, 3).forEach(player => {
        baseGame.addPlayer(player.id, player.meta)
      })

      expect(baseGame.full).toBe(false)
      expect(baseGame.players.size).toBe(3)
      expect(baseGame.currentPlayers).toBe(3)
    })

    it('should not accept players when .closed property is true', () => {
      const baseGame = createBaseGame()
      const player = {
        meta: {
          name: 'Let me in please!',
          team: 'two'
        },
        id: nanoid.nanoid()
      }

      TESTING_PLAYERS.slice(0, 3).forEach(player => {
        baseGame.addPlayer(player.id, player.meta)
      })

      baseGame.closed = true

      const func = () => {
        baseGame.addPlayer(player.id, player.meta)
      }

      expect(baseGame.full).toBeFalse()
      expect(baseGame.closed).toBeTrue()
      expect(baseGame.players.size).toBe(3)
      expect(baseGame.currentPlayers).toBe(3)
      expect(func).toThrowError(RangeError)
      expect(func).toThrowError('Could not add player. Game is either full or closed.')
    })

    it('should not accept players when game is full', () => {
      const baseGame = createBaseGame()
      const player = {
        meta: {
          name: 'Let me in please!',
          team: 'two'
        },
        id: nanoid.nanoid()
      }

      // We want to add all four testing players this time.
      TESTING_PLAYERS.forEach(player => {
        baseGame.addPlayer(player.id, player.meta)
      })

      const func = () => {
        baseGame.addPlayer(player.id, player.meta)
      }

      expect(baseGame.full).toBeTrue()
      expect(baseGame.closed).toBeFalse()
      expect(baseGame.players.size).toBe(4)
      expect(baseGame.currentPlayers).toBe(4)
      expect(func).toThrowError(RangeError)
      expect(func).toThrowError('Could not add player. Game is either full or closed.')
    })
  })

  it('should be able to serialize the current state for the specified client', () => {
    const baseGame = createBaseGame()
    const player = TESTING_PLAYERS[1]

    baseGame.addPlayer(player.id, player.meta)

    const expectedPosition = player.meta.team === 'one'
      ? { x: 0, y: 0 }
      : { x: 200, y: 200 }
    const state = baseGame.serializeStateFor(player.id)

    expect(JSON.parse(state).self.position).toEqual(expectedPosition)
    expect(JSON.parse(state).self.velocity).toEqual({ x: 0, y: 0 })
  })

  it('should be able to remove the specified player', () => {
    const baseGame = createBaseGame()

    TESTING_PLAYERS.forEach(player => {
      baseGame.addPlayer(player.id, player.meta)
    })

    expect(baseGame.full).toBeTrue()
    expect(baseGame.players.size).toBe(4)
    expect(baseGame.currentPlayers).toBe(4)

    const playerToRemove = TESTING_PLAYERS[2]

    baseGame.removePlayer(playerToRemove.id)

    expect(baseGame.full).toBeFalse()
    expect(baseGame.players.size).toBe(3)
    expect(baseGame.currentPlayers).toBe(3)
    expect(baseGame.getPlayerByID(playerToRemove.id)).toBeFalsy()
  })

  it('should be able to call every player\'s .update() method', () => {
    const spies = []
    const baseGame = createBaseGame()

    TESTING_PLAYERS.forEach(player => {
      baseGame.addPlayer(player.id, player.meta)
    })

    baseGame.players.forEach(player => {
      const spy = jasmine.createSpy('Player update() method spy', player.update)
      player.update = spy

      spies.push(spy)
    })

    baseGame.update()

    expect(spies).toHaveSize(TESTING_PLAYERS.length)
    spies.forEach(spy => {
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.calls.all().length).toBe(1)
      expect(spy.calls.argsFor(0).every(val => typeof val === 'number')).toBe(true)
    })
  })

  it('should be able to clear all players', () => {
    const baseGame = createBaseGame()

    TESTING_PLAYERS.forEach(player => {
      baseGame.addPlayer(player.id, player.meta)
    })

    expect(baseGame.full).toBeTrue()
    expect(baseGame.players.size).toBe(4)
    expect(baseGame.currentPlayers).toBe(4)

    baseGame.clearPlayers()

    expect(baseGame.full).toBe(false)
    expect(baseGame.players.size).toBe(0)
    expect(baseGame.currentPlayers).toBe(0)
  })
})
