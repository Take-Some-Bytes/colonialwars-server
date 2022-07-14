/* eslint-env node */
/**
 * @fileoverview Specs for player entities.
 */

const debug = require('debug')('colonialwars:systems:player')

const Vector2D = require('../physics/vector-2d')

/**
 * @typedef {import('../physics/vector-2d').Vector2DLike} Vector2DLike
 * @typedef {import('../../ecs/world')} World
 *
 * @typedef {Object} AddPlayerOpts
 * @prop {string} id
 * @prop {string} name
 * @prop {string} team
 * @prop {number} mass
 * @prop {number} speed
 * @prop {Vector2DLike} position
 *
 * @typedef {Object} ProcessInputsOpts
 * @prop {number} currentTime
 *
 * @typedef {Object} GetVelocityOpts
 * @prop {number} speed
 */

/**
 * Gets the velocity of this player with the given input.
 * @param {PlayerInput} data The input data.
 * @param {GetVelocityOpts} opts Required options.
 * @returns {InstanceType<Vector2D>}
 * @private
 */
function _getVelocity (data, opts) {
  const directionData = data.direction
  const verticalVelocity = Vector2D.zero()
  const horizontalVelocity = Vector2D.zero()

  if (directionData.up) {
    verticalVelocity.add(Vector2D.fromArray([0, -opts.speed]))
  } else if (directionData.down) {
    verticalVelocity.add(Vector2D.fromArray([0, opts.speed]))
  } else {
    verticalVelocity.zero()
  }

  if (directionData.left) {
    horizontalVelocity.add(Vector2D.fromArray([-opts.speed, 0]))
  } else if (directionData.right) {
    horizontalVelocity.add(Vector2D.fromArray([opts.speed, 0]))
  } else {
    horizontalVelocity.zero()
  }

  return Vector2D.zero().add(verticalVelocity).add(horizontalVelocity)
}

/**
 * Adds a player entity and components to an ECS world.
 * @param {World} world The ECS world to add the player entity to.
 * @param {AddPlayerOpts} opts Required options.
 */
function addPlayerTo (world, opts) {
  const entity = world.create()

  world.addComponent('physicalProps', {
    to: entity,
    opts: {
      mass: opts.mass,
      speed: opts.speed
    }
  })
  world.addComponent('transform2d', {
    to: entity,
    opts: {
      position: opts.position
    }
  })
  world.addComponent('player', {
    to: entity,
    opts: {
      id: opts.id,
      name: opts.name,
      team: opts.team
    }
  })

  world.addComponent('velocity2d', {
    to: entity
  })
}

/**
 * Processes all the inputs of all the player entities in an ECS world.
 * @param {World} world The ECS world to process the inputs in.
 * @param {ProcessInputsOpts} opts Required options.
 */
function processInputs (world, opts) {
  for (const entry of world.allInstancesOf('player')) {
    const entity = entry.entity
    /** @type {import('../components/player')} */
    const player = entry.component
    const velocity = world.getComponent('velocity2d', { from: entity })
    const transform = world.getComponent('transform2d', { from: entity })
    const props = world.getComponent('physicalProps', { from: entity })

    const inputs = player.inputQueue.splice(0)

    if (inputs.length < 1) {
      // There are no input changes.
      // Continue doing what we did last time.
      const deltaTime = opts.currentTime - player.lastUpdateTime

      transform.position.add(Vector2D.floorAxes(Vector2D.scale(velocity.velocity, deltaTime)))
      player.lastUpdateTime = opts.currentTime
      continue
    }

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]

      if (input.inputNum <= player.lastProcessedInput) {
        // Input sequence number is smaller than last processed input,
        // number, so we gotta skip it.
        debug(
          'Received invalid input sequence number! ' +
          'Last received input: #%d, invalid input: #%d',
          player.lastProcessedInput, input.inputNum
        )
        continue
      } else if (input.timestamp < player.lastUpdateTime) {
        // Input happened earlier than the occurance of the last update,
        // which should not happen. SKIP!
        debug(
          'Received invalid input timestamp! ' +
          'Timestamp records an earlier time than last update time.'
        )
        continue
      }

      velocity.velocity = _getVelocity(input, { speed: props.speed })

      const deltaTime = input.timestamp - player.lastUpdateTime
      player.lastUpdateTime = input.timestamp

      transform.position.add(Vector2D.floorAxes(Vector2D.scale(velocity.velocity, deltaTime)))

      player.lastProcessedInput = input.inputNum
    }
  }
}

module.exports = {
  addPlayerTo,
  processInputs
}
