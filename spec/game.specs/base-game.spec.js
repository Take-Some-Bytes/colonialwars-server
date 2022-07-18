/* eslint-env jasmine */
/**
 * @fileoverview Specs for the BaseGame class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const nanoid = require('nanoid')

const Vector2D = require('../../lib/game/physics/vector2d')
const { BaseGame } = require('../../lib/game/modes')

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

/**
 * Utility function to get the input queue of the specified player.
 * @param {World} world The ECS world.
 * @param {string} playerId The player ID.
 * @returns {Array<import('../../lib/game/components/player').PlayerInput>}
 */
function getInputQueue (world, playerId) {
  const playerEntity = world.query().with('player').find(e => {
    const info = world.getComponent('player', { from: e })

    return info.id === playerId
  }).one()

  return world.getComponent('player', { from: playerEntity }).inputQueue
}

describe('The BaseGame class,', () => {
  describe('when processing a game step,', () => {
    it('should call abstract pre-step, post-step, and step methods', () => {
      const baseGame = createBaseGame()

      const pre = spyOn(baseGame, 'preStep')
      const step = spyOn(baseGame, 'step')
      const post = spyOn(baseGame, 'postStep')

      baseGame.update()

      expect(pre).toHaveBeenCalled()
      expect(step).toHaveBeenCalled()
      expect(post).toHaveBeenCalled()
    })

    it('should call internal pre-step, post-step, and step methods', () => {
      const baseGame = createBaseGame()

      const pre = spyOn(baseGame, '_preStep')
      const step = spyOn(baseGame, '_step')
      const post = spyOn(baseGame, '_postStep')

      baseGame.update()

      expect(pre).toHaveBeenCalled()
      expect(step).toHaveBeenCalled()
      expect(post).toHaveBeenCalled()
    })

    it('should emit events signaling when an update phase happens', () => {
      const events = []
      const baseGame = createBaseGame()

      baseGame.on('preStep', () => events.push('preStep'))
      baseGame.on('step', () => events.push('step'))
      baseGame.on('postStep', () => events.push('postStep'))

      baseGame.update()

      expect(events).toHaveSize(3)
      expect(events[0]).toBe('preStep')
      expect(events[1]).toBe('step')
      expect(events[2]).toBe('postStep')
    })

    it('should keep track of the step count', () => {
      const baseGame = createBaseGame()

      expect(baseGame.stepCount).toBe(0)

      baseGame.update()
      baseGame.update()

      expect(baseGame.stepCount).toBe(2)

      baseGame.update()

      expect(baseGame.stepCount).toBe(3)
    })
  })

  describe('The .addPlayer() method,', () => {
    it('should be able to add new players when space is available', () => {
      const baseGame = createBaseGame()

      TESTING_PLAYERS.slice(0, 3).forEach(player => {
        baseGame.addPlayer(player.id, player.meta)
      })

      expect(baseGame.full).toBe(false)
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
      expect(baseGame.currentPlayers).toBe(4)
      expect(func).toThrowError(RangeError)
      expect(func).toThrowError('Could not add player. Game is either full or closed.')
    })

    it('should not accept players to a team if said team is full', () => {
      const baseGame = createBaseGame()
      const player = {
        meta: {
          name: 'Let me in please!',
          team: 'one'
        },
        id: nanoid.nanoid()
      }

      TESTING_PLAYERS.slice(0, 3).forEach(player => {
        baseGame.addPlayer(player.id, player.meta)
      })

      const func = () => {
        baseGame.addPlayer(player.id, player.meta)
      }

      expect(baseGame.full).toBeFalse()
      expect(baseGame.currentPlayers).toBe(3)
      expect(func).toThrowError(RangeError)
      expect(func).toThrowError('Team is full!')
    })
  })

  describe('when adding inputs,', () => {
    it('should throw an error if player does not exist', () => {
      const baseGame = createBaseGame()

      expect(() => {
        baseGame.addInputTo('no_exist', { direction: { up: true } })
      }).toThrowError(/^.*player does not exist.*$/i)
    })

    it('should be able to successfully add them to the specified player', () => {
      const baseGame = createBaseGame()
      const player = TESTING_PLAYERS[1]
      const other = TESTING_PLAYERS[3]

      baseGame.addPlayer(player.id, player.meta)
      baseGame.addPlayer(other.id, other.meta)

      // Let's make everyone believe that it's only been 100 milliseconds since
      // the Unix epoch!
      spyOn(Date, 'now').and.callFake(() => 100)

      baseGame.addInputTo(player.id, { inputNum: 1, direction: { up: true } })

      const queue1 = getInputQueue(baseGame._world, player.id)
      const queue2 = getInputQueue(baseGame._world, other.id)

      expect(queue1).toHaveSize(1)
      expect(queue2).toHaveSize(0)

      expect(queue1.pop()).toEqual({
        inputNum: 1,
        timestamp: 100,
        direction: { up: true }
      })
    })
  })

  it("should be able to get a player's name by their ID", () => {
    const baseGame = createBaseGame()
    const player = TESTING_PLAYERS[2]

    baseGame.addPlayer(player.id, player.meta)

    const ret = baseGame.getPlayerNameByID(player.id)

    expect(ret).toBeInstanceOf(String)
    expect(ret).toBe(player.meta.name)
  })

  it('should be able to remove the specified player', () => {
    const baseGame = createBaseGame()

    TESTING_PLAYERS.forEach(player => {
      baseGame.addPlayer(player.id, player.meta)
    })

    expect(baseGame.full).toBeTrue()
    expect(baseGame.currentPlayers).toBe(4)

    const playerToRemove = TESTING_PLAYERS[2]

    baseGame.removePlayer(playerToRemove.id)

    expect(baseGame.full).toBeFalse()
    expect(baseGame.currentPlayers).toBe(3)
    expect(baseGame.getPlayerNameByID(playerToRemove.id)).toBeFalsy()
  })

  it('should be able to clear all players', () => {
    const baseGame = createBaseGame()

    TESTING_PLAYERS.forEach(player => {
      baseGame.addPlayer(player.id, player.meta)
    })

    expect(baseGame.full).toBeTrue()
    expect(baseGame.currentPlayers).toBe(4)

    baseGame.clearPlayers()

    expect(baseGame.full).toBe(false)
    expect(baseGame.currentPlayers).toBe(0)
  })

  it('should be able to iterate over the names of all players', () => {
    const baseGame = createBaseGame()

    TESTING_PLAYERS.forEach(player => {
      baseGame.addPlayer(player.id, player.meta)
    })

    expect(baseGame.full).toBeTrue()
    expect(baseGame.currentPlayers).toBe(4)

    const iter = baseGame.allPlayerNames()

    expect(iter.next).toBeInstanceOf(Function)
    expect(iter[Symbol.iterator]).toBeInstanceOf(Function)

    const arr = Array.from(iter)

    expect(arr).toHaveSize(4)
    TESTING_PLAYERS.map(p => p.meta.name).forEach(name => {
      expect(arr).toContain(name)
    })
  })

  it('should be able to serialize state for all players', () => {
    const baseGame = createBaseGame()

    TESTING_PLAYERS.forEach(player => {
      baseGame.addPlayer(player.id, player.meta)
    })

    const states = Array.from(baseGame.serializeState())

    expect(states).toHaveSize(4)

    for (let i = 0; i < states.length; i++) {
      const state = states[i]
      const expectedPosition = i % 2 === 0
        ? Vector2D.zero()
        : new Vector2D(200, 200)

      expect(baseGame.getPlayerNameByID(state.id)).toBeInstanceOf(String)
      expect(state.contents).toBeInstanceOf(Object)
      expect(state.contents.self.position).toEqual(expectedPosition)
      expect(state.contents.self.velocity).toEqual(Vector2D.zero())
    }
  })
})
