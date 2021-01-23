/* eslint-env jasmine */
/**
 * @fileoverview Specs for the Player class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const Player = require('../lib/game/player')
const Vector2D = require('../lib/game/physics/vector-2d')
const BoundEntity = require('../lib/game/physics/bound-entity')

const playerStats = {
  name: 'THISISTHEFBI',
  team: 'Britash',
  socketID: '1jkMZ0tuM0Eahm2aHAPqbQ==',
  position: new Vector2D(),
  playerConf: {
    PLAYER_SPEED: 0.4,
    WORLD_BOUNDS: {
      MIN: 0,
      MAX: 200
    }
  }
}
const lastUpdateTime = Date.now()

describe('The Player class,', () => {
  let player = null
  it('should construct without error', () => {
    let err = null

    try {
      player = new Player({
        name: playerStats.name,
        team: playerStats.team,
        socketID: playerStats.socketID,
        position: playerStats.position,
        PLAYER_SPEED: playerStats.playerConf.PLAYER_SPEED,
        WORLD_BOUNDS: playerStats.playerConf.WORLD_BOUNDS
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(player).toBeInstanceOf(Player)
    expect(player).toBeInstanceOf(BoundEntity)
  })

  describe('The .update() method,', () => {
    it('should not change player position if player velocity is [0, 0]', () => {
      let oldPlayerPos = null
      if (player instanceof Player) {
        oldPlayerPos = player.position.copy()
        player.update(lastUpdateTime, Date.now() - lastUpdateTime)
      }

      expect(oldPlayerPos).toEqual(player.position)
    })
    it('should bound player position if it is out of bounds', () => {
      const outOfBoundsPos = new Vector2D(300, 300)
      if (player instanceof Player) {
        player.position = outOfBoundsPos.copy()
        player.update(lastUpdateTime, Date.now() - lastUpdateTime)
      }

      expect(player.position).not.toEqual(outOfBoundsPos)
      expect(player.position).toEqual(new Vector2D(200, 200))
    })
    it('should increase player position by the player velocity', () => {
      const velocity = new Vector2D(-0.4, -0.4)
      if (player instanceof Player) {
        player.velocity = velocity.copy()
        player.update(Date.now(), 5)
      }

      expect(player.position).toEqual(new Vector2D(198, 198))
      expect(player.position).toEqual(
        new Vector2D(200, 200).add(Vector2D.scale(velocity, 5))
      )
    })
  })

  describe('The .updateOnInput() method,', () => {
    it('should change the player velocity based on the input data', () => {
      const inputs = [
        { direction: { up: true } },
        { direction: { down: true } },
        { direction: { left: true } },
        { direction: { right: true } },
        // No input.
        { direction: {} },
        // Multi-true input, always takes the first truthy
        // input direction that is checked and uses that.
        { direction: { up: true, down: true } },
        { direction: { down: true, left: true } },
        { direction: { left: false, right: true, down: true } }
      ]
      const velocities = []

      if (player instanceof Player) {
        inputs.forEach(input => {
          player.updateOnInput(input)
          velocities.push(player.velocity)
          player.velocity = Vector2D.zero()
        })
      }

      expect(velocities.length).toBe(8)
      expect(velocities[0]).toEqual(new Vector2D(0, -0.4))
      expect(velocities[1]).toEqual(new Vector2D(0, 0.4))
      expect(velocities[2]).toEqual(new Vector2D(-0.4, 0))
      expect(velocities[3]).toEqual(new Vector2D(0.4, 0))
      expect(velocities[4]).toEqual(Vector2D.zero())
      expect(velocities[5]).toEqual(new Vector2D(0, -0.4))
      expect(velocities[6]).toEqual(new Vector2D(0, 0.4))
      expect(velocities[7]).toEqual(new Vector2D(0, 0.4))
    })
    it('should reset player velocity if no direction input was passed', () => {
      const input = {
        direction: {
          up: false,
          down: false,
          left: false,
          right: false
        }
      }
      const velocityBeforeInput = new Vector2D(2, 0)

      if (player instanceof Player) {
        player.velocity = velocityBeforeInput.copy()
        player.updateOnInput(input)
      }

      expect(player.velocity).not.toEqual(velocityBeforeInput)
      expect(player.velocity).toEqual(Vector2D.zero())
    })
  })
})
