/* eslint-env node */
/**
 * @fileoverview Specs for player entities.
 */

import debugFactory from 'debug'

import { Vector2D } from 'colonialwars-lib/math'

const debug = debugFactory('colonialwars:systems:player')

/**
 * @typedef {import('../physics/vector2d').Vector2DLike} Vector2DLike
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
 * @prop {Vector2DLike} worldLimits
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
  const velocity = Vector2D.zero()

  if (directionData.up) {
    velocity.add({ x: 0, y: -opts.speed })
  } else if (directionData.down) {
    velocity.add({ x: 0, y: opts.speed })
  }

  if (directionData.left) {
    velocity.add({ x: -opts.speed, y: 0 })
  } else if (directionData.right) {
    velocity.add({ x: opts.speed, y: 0 })
  }

  return velocity
}

/**
 * Adds a player entity and components to an ECS world.
 * @param {World} world The ECS world to add the player entity to.
 * @param {AddPlayerOpts} opts Required options.
 */
export function addPlayerTo (world, opts) {
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
export function processInputs (world, opts) {
  for (const entry of world.allInstancesOf('player')) {
    const entity = entry.entity
    /** @type {import('../components/player').default} */
    const player = entry.component
    const velocity = world.getComponent('velocity2d', { from: entity })
    const transform = world.getComponent('transform2d', { from: entity })
    const props = world.getComponent('physicalProps', { from: entity })

    const inputs = player.inputQueue
    let nextInput = inputs.shift()

    for (; nextInput && nextInput.timestamp <= opts.currentTime; nextInput = inputs.shift()) {
      if (nextInput.inputNum <= player.lastProcessedInput) {
        // Input sequence number is smaller than last processed input,
        // number, so we gotta skip it.
        debug(
          'Received invalid input sequence number! ' +
            'Last received input: #%d, invalid input: #%d',
          player.lastProcessedInput, nextInput.inputNum
        )
        continue
      } else if (nextInput.timestamp < player.lastUpdateTime) {
        // Input happened earlier than the occurance of the last update,
        // which should not happen. SKIP!
        debug(
          'Received invalid input timestamp! ' +
            'Timestamp records an earlier time than last update time.'
        )
        continue
      }

      velocity.velocity = _getVelocity(nextInput, { speed: props.speed })

      const deltaTime = nextInput.timestamp - player.lastUpdateTime
      player.lastUpdateTime = nextInput.timestamp

      transform.position.add(Vector2D.floorAxes(Vector2D.scale(velocity.velocity, deltaTime)))
      transform.position.boundTo(opts.worldLimits)

      player.lastProcessedInput = nextInput.inputNum
    }

    if (nextInput) {
      // Put the input back.
      inputs.unshift(nextInput)
    }

    // Here, a few things could have happened:
    //   1. There were no new inputs.
    //   2. All new inputs were processed.
    //   3. Some new inputs were processed, and the rest were left for a later
    //      time due to opts.currentTime.
    //
    // Whatever the reason, we must continue the simulation.
    const deltaTime = opts.currentTime - player.lastUpdateTime

    transform.position.add(Vector2D.floorAxes(Vector2D.scale(velocity.velocity, deltaTime)))
    transform.position.boundTo(opts.worldLimits)
    player.lastUpdateTime = opts.currentTime
  }
}
