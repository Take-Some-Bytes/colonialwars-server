/* eslint-env node */
/**
 * @fileoverview A bunch of physics-related components.
 */

const Vector2D = require('../physics/vector-2d')

/**
 * @typedef {Record<'mass'|'speed', number>} PhysicalPropsOpts
 *
 * @typedef {Object} Transform2d
 * @prop {import('../physics/vector-2d').Vector2DLike} position
 */

/**
 * A component containing some basic physical properties.
 */
class PhysicalProps {
  /**
   * Create a new PhysicalProps component.
   * @param {PhysicalPropsOpts} opts Specify the mass and speed of the object.
   */
  constructor (opts) {
    this.mass = opts.mass
    this.speed = opts.speed
  }
}

/**
 * A component representing a physical entity's position in a 2D world.
 */
class Transform2d {
  /**
   * Create a new Transform2d component with an initial position.
   * @param {Transform2dOpts} opts Specify initial position of the object.
   */
  constructor (opts) {
    this.position = Vector2D.fromObject(opts.position || Vector2D.zero())
  }
}

/**
 * A component representing a physical entity's velocity in a 2D world.
 */
class Velocity2d {
  /**
   * Create a new Velocity2d component with an initial velocity of 0 in all axes.
   * @param {undefined} _opts Options are not taken
   */
  constructor (_opts) {
    this.velocity = Vector2D.zero()
  }
}

module.exports = {
  PhysicalProps,
  Transform2d,
  Velocity2d
}
