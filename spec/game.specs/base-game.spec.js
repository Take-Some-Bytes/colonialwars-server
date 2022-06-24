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

describe('The BaseGame class,', () => {
  /**
   * @type {Array<{ meta: Record<'name'|'team', string>, id: string }>}
   */
  const players = []
  let baseGame = null

  it('should construct without error', () => {
    let err = null
    try {
      baseGame = new BaseGame({
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
      baseGame.init()
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(baseGame).toBeInstanceOf(BaseGame)
  })

  describe('The .addPlayer() method,', () => {
    it('should be able to add new players when space is available', () => {
      let err = null
      const newPlayers = [
        {
          meta: {
            name: 'GENERAL LOUDSPEAKER',
            team: 'one'
          },
          id: nanoid.nanoid()
        },
        {
          meta: {
            name: 'THISISTHEPOLICE',
            team: 'two'
          },
          id: nanoid.nanoid()
        },
        {
          meta: {
            name: 'socialsecurity',
            team: 'one'
          },
          id: nanoid.nanoid()
        }
      ]

      try {
        newPlayers.forEach(player => {
          if (baseGame instanceof BaseGame) {
            baseGame.addPlayer(player.id, player.meta)
            players.push(player)
          }
        })
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(baseGame.full).toBe(false)
      expect(baseGame.players.size).toBe(3)
      expect(baseGame.currentPlayers).toBe(3)
    })

    it('should not accept players when .closed property is true', () => {
      let err = null
      const player = {
        meta: {
          name: 'Let me in please!',
          team: 'two'
        },
        id: nanoid.nanoid()
      }

      try {
        if (baseGame instanceof BaseGame) {
          baseGame.closed = true
          baseGame.addPlayer(player.id, player.meta)
          players.push(player)
        } else {
          throw new TypeError()
        }
      } catch (ex) {
        err = ex
      }

      expect(err).toBeInstanceOf(RangeError)
      expect(err.message).toBe('Could not add player. Game is either full or closed.')
    })

    it('should not accept players when game is full', () => {
      const errors = []
      const newPlayers = [
        { meta: { name: 'FBIOPENUP', team: 'two' }, id: nanoid.nanoid() },
        { meta: { name: 'Let me in please!', team: 'two' }, id: nanoid.nanoid() }
      ]

      baseGame.closed = false
      newPlayers.forEach(player => {
        try {
          if (baseGame instanceof BaseGame) {
            baseGame.addPlayer(player.id, player.meta)
            players.push(player)
            errors.push(null)
          } else {
            throw new TypeError()
          }
        } catch (ex) {
          errors.push(ex)
        }
      })

      expect(errors.length).toBe(2)
      expect(errors[0]).toBe(null)
      expect(errors[1]).toBeInstanceOf(RangeError)
      expect(baseGame.full).toBe(true)
      expect(baseGame.players.size).toBe(4)
      expect(baseGame.currentPlayers).toBe(4)
    })
  })

  it('should be able to serialize the current state for the specified client', () => {
    const player = players[1]
    const expectedPosition = player.meta.team === 'one'
      ? { x: 0, y: 0 }
      : { x: 200, y: 200 }
    const state = baseGame.serializeStateFor(player.id)

    expect(JSON.parse(state).self.position).toEqual(expectedPosition)
    expect(JSON.parse(state).self.velocity).toEqual({ x: 0, y: 0 })
  })

  it('should be able to remove the specified player', () => {
    const player = players.splice(2, 1)[0]

    baseGame.removePlayer(player.id)

    expect(baseGame.full).toBe(false)
    expect(baseGame.players.size).toBe(3)
    expect(baseGame.currentPlayers).toBe(3)

    expect(baseGame.getPlayerByID(player.id)).toBeFalsy()
  })

  it('should be able to call every player\'s .update() method', () => {
    /**
     * @type {Array<jasmine.Spy<import('../../lib/game/player')['prototype']['update']>>}
     */
    const spies = []
    if (baseGame instanceof BaseGame) {
      const players = new Map(baseGame.players.entries())
      baseGame.players = new Map(Array.from(players.entries()).map(
        entry => {
          const spy = jasmine.createSpy('Player update() method spy', entry[1].update)
          entry[1].update = spy
          spies.push(spy)
          return [entry[0], entry[1]]
        }
      ))
      baseGame.update()
      // Restore original Player implementations.
      baseGame.players = new Map(players.entries())
    }

    expect(spies.length).toBe(3)
    spies.forEach(spy => {
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.calls.all().length).toBe(1)
      expect(spy.calls.argsFor(0).every(val => typeof val === 'number')).toBe(true)
    })
  })

  it('should be able to clear all players', () => {
    baseGame.clearPlayers()

    expect(baseGame.full).toBe(false)
    expect(baseGame.players.size).toBe(0)
    expect(baseGame.currentPlayers).toBe(0)
  })
})
