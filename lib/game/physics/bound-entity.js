/* eslint-env node */
/**
 * @fileoverview BoundEntity class to represent any object that is
 * bound to a minimum and maximum.
 */

const Vector2D = require('./vector-2d')
const mathUtils = require('../../utils/math-utils')

/**
 * @typedef {Object} Bounds
 * @prop {number} MIN
 * @prop {number} MAX
 */

/**
 * BoundEntity class.
 */
class BoundEntity {
  /**
   * Constructor for a BoundEntity class.
   * @param {InstanceType<Vector2D>} position The starting position of the
   * BoundEntity instance.
   * @param {Readonly<Bounds>} bounds The minimum and maximum bounds for this BoundEntity.
   */
  constructor (position, bounds) {
    this.position = position || Vector2D.zero()
    this.bounds = bounds
  }

  /**
   * Tests if this BoundEntity is inside its bounds.
   * @returns {boolean}
   */
  inBounds () {
    return (
      mathUtils.inBound(this.position.x, this.bounds.MIN, this.bounds.MAX) &&
      mathUtils.inBound(this.position.y, this.bounds.MIN, this.bounds.MAX)
    )
  }

  /**
   * Bounds this BoundEntity's position within the supplied bounds if it is
   * outside of the bounds.
   */
  boundToBounds () {
    this.position.x = mathUtils.bound(
      this.position.x, this.bounds.MIN, this.bounds.MAX
    )
    this.position.y = mathUtils.bound(
      this.position.y, this.bounds.MIN, this.bounds.MAX
    )
  }
}

module.exports = exports = BoundEntity
