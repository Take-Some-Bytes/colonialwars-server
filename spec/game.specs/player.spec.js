/* eslint-env jasmine */
/**
 * @fileoverview Specs for the Player class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import Player from '../../lib/game/player.js'
import Vector2D from '../../lib/game/physics/vector2d.js'
import BoundEntity from '../../lib/game/physics/bound-entity.js'

const playerStats = {
  name: 'THISISTHEFBI',
  team: 'Britash',
  socketID: '1jkMZ0tuM0Eahm2aHAPqbQ==',
  position: new Vector2D(),
  playerConf: {
    PLAYER_SPEED: 0.4,
    WORLD_BOUNDS: Object.freeze({
      x: {
        MIN: 0,
        MAX: 200
      },
      y: {
        MIN: 0,
        MAX: 200
      }
    })
  }
}

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

  describe('the .update() method,', () => {
    it("should call the Player object's .processInputs() method", () => {
      const oldProcessInputs = player.processInputs
      let calls = 0
      let spy = null

      if (player instanceof Player) {
        // Replace player.processInputs with a spy.
        spy = jasmine.createSpy('Player processInputs() method spy', oldProcessInputs).and.callFake(() => {
          calls++
        })

        player.processInputs = spy
        player.update()
      }

      expect(calls).toBe(1)
      expect(spy.calls.count()).toBe(1)
      expect(spy.calls.first().args.length).toBe(0)

      // Restore player processInputs() method.
      player.processInputs = oldProcessInputs
    })
  })

  describe('the .updateOnInput() method,', () => {
    it('should change the player velocity based on the input data', () => {
      const inputs = [
        { direction: { up: true } },
        { direction: { down: true } },
        { direction: { left: true } },
        { direction: { right: true } },
        // No input.
        { direction: {} },
        { direction: { up: true, down: true } }, // Velocity = (x: 0, y: -0.4)
        { direction: { right: true, left: true } }, // Velocity = (x: -0.4, y: 0)
        { direction: { down: true, left: true } }, // Velocity = (x: -0.4, y: 0.4)
        { direction: { right: true, up: true } } // Velocity = (x: 0.4, y: -0.4)
      ]
      const velocities = []

      if (player instanceof Player) {
        inputs.forEach(input => {
          player.updateOnInput(input)
          velocities.push(player.velocity)
          player.velocity = Vector2D.zero()
        })
      }

      expect(velocities.length).toBe(9)
      expect(velocities[0]).toEqual(new Vector2D(0, -0.4))
      expect(velocities[1]).toEqual(new Vector2D(0, 0.4))
      expect(velocities[2]).toEqual(new Vector2D(-0.4, 0))
      expect(velocities[3]).toEqual(new Vector2D(0.4, 0))
      expect(velocities[4]).toEqual(Vector2D.zero())
      expect(velocities[5]).toEqual(new Vector2D(0, -0.4))
      expect(velocities[6]).toEqual(new Vector2D(-0.4, 0))
      expect(velocities[7]).toEqual(new Vector2D(-0.4, 0.4))
      expect(velocities[8]).toEqual(new Vector2D(0.4, -0.4))
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

  describe('the .addInputToQueue() method,', () => {
    it('should reject any input object without a timestamp.', () => {
      const inputs = [
        { timestamp: null, inputNum: 1, invalidInput: true },
        { timestamp: 0 / 0, inputNum: 2, direction: {} },
        { timestamp: Infinity, inputNum: 3, direction: 0 / 0 },
        { inputNum: 4 } // Mostly empty object.
      ]
      const errors = []

      if (player instanceof Player) {
        for (const input of inputs) {
          try {
            player.addInputToQueue(input)
          } catch (ex) {
            errors.push(ex)
          }
        }
      }

      expect(errors.length).toBe(4)
      expect(player.inputQueue.length).toBe(0)
      expect(errors.every(err => err instanceof TypeError)).toBe(true)
    })
  })
  it('should accept all valid input objects.', () => {
    const inputs = [
      // All truthy values will be converted to true, and all
      // falsy values will be converted to false.
      {
        timestamp: Date.now(),
        inputNum: 5,
        direction: {
          up: false,
          down: 1,
          left: 'yes',
          right: ''
        }
      },
      { timestamp: Date.now(), inputNum: 6, direction: { up: 1 } },
      { timestamp: Date.now(), inputNum: 7, direction: { right: (0) + 0 } }
    ]
    const errors = []

    if (player instanceof Player) {
      for (const input of inputs) {
        try {
          player.addInputToQueue(input)
        } catch (ex) {
          errors.push(ex)
        }
      }
    }

    expect(errors.length).toBe(0)
    expect(player.inputQueue.length).toBe(3)
    expect(player.inputQueue.every(o => typeof o === 'object')).toBe(true)
    // Reset player input queue.
    player.inputQueue.splice(0)
  })

  describe('the .processInputs() method,', () => {
    let oldPlayerPos = null
    let oldLastUpdateTime = null

    beforeAll(() => {
      // Get the actual player position and last update time.
      oldPlayerPos = player.position.copy()
      oldLastUpdateTime = player.lastUpdateTime
    })
    afterEach(() => {
      // Reset player position, last update time, and input queue.
      player.position = oldPlayerPos.copy()
      player.lastUpdateTime = oldLastUpdateTime
      player.inputQueue.splice(0)
    })

    it('should process all valid queued inputs.', () => {
      const inputs = [
        // We use non-realistic timestamps for testing purposes.
        { timestamp: 100, inputNum: 1, direction: { down: 1, right: 1 } },
        { timestamp: 110, inputNum: 2, direction: { down: 1, left: 1 } },
        { timestamp: 120, inputNum: 3, direction: { right: 1 } },
        { timestamp: 130, inputNum: 4, direction: { up: 1 } }
      ]
      const oldPlayerPos = player.position.copy()
      let err = null

      if (player instanceof Player) {
        try {
          player.velocity = Vector2D.zero()
          player.position = Vector2D.zero()
          for (const input of inputs) {
            player.addInputToQueue(input)
          }
          // Set last update time to 90 for testing purposes.
          player.lastUpdateTime = 90
          player.processInputs()
        } catch (ex) {
          err = ex
        }
      }

      expect(err).toBe(null)
      expect(player.lastProcessedInput).toBe(4)
      expect(player.position).not.toEqual(oldPlayerPos)
      expect(player.position).toEqual(new Vector2D(
        4, 4
      ))
      // Reset the remaining player information.
      player.lastProcessedInput = 0
    })
    it('should not process invalid queued inputs.', () => {
      const inputs = [
        // Again, we use non-realistic timestamps for testing purposes.
        { timestamp: 100, inputNum: 0, direction: { left: 1 } }, // Invalid input num.
        { timestamp: 80, inputNum: 1, direction: { left: 1 } } // Timestamp records a very incorrect time.
      ]
      let err = null

      if (player instanceof Player) {
        try {
          player.velocity = Vector2D.zero()
          player.position = Vector2D.zero()

          for (const input of inputs) {
            player.addInputToQueue(input)
          }

          // Set last update time to 90 for testing purposes.
          player.lastUpdateTime = 90
          player.processInputs()
        } catch (ex) {
          err = ex
        }
      }

      expect(err).toBe(null)
      expect(player.lastProcessedInput).toBe(0)
      expect(player.position).toEqual(Vector2D.zero())
      // Reset the remaining player information.
      player.lastProcessedInput = 0
    })
    it('should keep incrementing player position by existing velocity if no input was passed', () => {
      const oldPlayerVelocity = player.velocity.copy()
      const oldDateNow = Date.now

      // Let's make everyone believe that the current time is 100ms
      Date.now = () => {
        return 100
      }

      if (player instanceof Player) {
        player.position = Vector2D.zero()
        player.velocity = new Vector2D(0.4, 0.4)
        player.lastUpdateTime = 90
        player.processInputs()
      }

      expect(player.lastUpdateTime).toBe(100)
      expect(player.position).toEqual(Vector2D.fromArray([4, 4]))

      player.velocity = oldPlayerVelocity
      Date.now = oldDateNow
    })
  })
})
