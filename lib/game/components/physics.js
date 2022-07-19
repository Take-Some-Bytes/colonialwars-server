/* eslint-env node */
/**
 * @fileoverview A bunch of physics-related components.
 */

import { Vector2D } from 'colonialwars-lib/math'

/**
 * @typedef {Record<'mass'|'speed', number>} PhysicalPropsOpts
 *
 * @typedef {Object} Transform2d
 * @prop {import('../physics/vector2d').Vector2DLike} position
 */

/**
 * A component containing some basic physical properties.
 */
export class PhysicalProps {
  /**
   * Gets the serializable properties of this component.
   * @returns {Array<string>}
   */
  static get properties () {
    return ['mass', 'speed']
  }

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
 * A component representing a physical entity's position and rotation
 * in a 2D world.
 */
export class Transform2d {
  /**
   * Gets the serializable properties of this component.
   * @returns {Array<string>}
   */
  static get properties () {
    return ['position', 'rotation']
  }

  /**
   * Create a new Transform2d component with the specified initial position and
   * a rotation of zero in all axes.
   * @param {Transform2dOpts} opts Specify initial position of the object.
   */
  constructor (opts) {
    this.position = Vector2D.fromObject(opts.position || Vector2D.zero())
    this.rotation = Vector2D.zero()
  }
}

/**
 * A component representing a physical entity's velocity in a 2D world.
 */
export class Velocity2d {
  /**
   * Gets the serializable properties of this component.
   * @returns {Array<string>}
   */
  static get properties () {
    return ['velocity']
  }

  /**
   * Create a new Velocity2d component with an initial velocity of 0 in all axes.
   * @param {undefined} _opts Options are not taken
   */
  constructor (_opts) {
    this.velocity = Vector2D.zero()
  }
}
