/* eslint-env node */
/**
 * @fileoverview Vector2D class for simple 2D physics manipulation.
 */

const { bound } = require('../../utils/math-utils')

/**
 * @typedef {{ x?: number; y?: number }} Vector2DLike
 */

/**
 * Vector2D class.
 */
class Vector2D {
  /**
   * Constructor for a Vector2D class.
   * @param {number} x The X component.
   * @param {number} y The Y component.
   */
  constructor (x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  /**
   * Creates a new Vector2D from an array.
   * @param {[number, number]} arr The array to create the Vector2D from.
   * @returns {Vector2D}
   */
  static fromArray (arr) {
    return new Vector2D(...arr)
  }

  /**
   * Creates a new Vector2D from an object.
   * @param {Vector2DLike} obj The object to create the Vector2D from.
   * @returns {Vector2D}
   */
  static fromObject (obj) {
    return new Vector2D(obj.x, obj.y)
  }

  /**
   * Creates a new vector from a magnitude and direction.
   * @param {number} mag The magnitude of the new Vector2D.
   * @param {number} theta The angle of the new Vector2D.
   * @returns {Vector2D}
   */
  static fromPolar (mag, theta) {
    return new Vector2D(mag * Math.cos(theta), mag * Math.sin(theta))
  }

  /**
   * Floors the axes of a Vector2D to a whole number and returns a new Vector2D
   * @param {Vector2D} vector The Vector2D to floor the axes of.
   * @returns {Vector2D}
   */
  static floorAxes (vector) {
    return new Vector2D(
      Math.floor(vector.x),
      Math.floor(vector.y)
    )
  }

  /**
   * Returns a Vector2D of zeroes.
   * @returns {Vector2D}
   */
  static zero () {
    return new Vector2D(0, 0)
  }

  /**
   * Scales a Vector2D by a constant scalar and returns a new Vector2D.
   * @param {Vector2D} vector The Vector2D to scale.
   * @param {number} scalar The constant to scale the Vector2D by.
   * @returns {Vector2D}
   */
  static scale (vector, scalar) {
    return new Vector2D(vector.x * scalar, vector.y * scalar)
  }

  /**
   * Adds another Vector2D to this Vector2D. Returns this Vector2D for method chaining.
   * @param {Vector2D} other The other Vector2D to add.
   * @returns {Vector2D}
   */
  add (other) {
    this.x += other.x
    this.y += other.y
    return this
  }

  /**
   * Returns a copy of this Vector2D.
   * @returns {Vector2D}
   */
  copy () {
    return new Vector2D(this.x, this.y)
  }

  /**
   * Resets both axes of this Vector2D to zero.
   * @returns {Vector2D}
   */
  zero () {
    this.x = 0
    this.y = 0
    return this
  }

  /**
   * Binds this Vector2D to the specified bounds.
   * @param {Vector2DLike} bounds The bounds to bind to.
   */
  boundTo (bounds) {
    this.x = bound(this.x, 0, bounds.x)
    this.y = bound(this.y, 0, bounds.y)
  }
}

module.exports = Vector2D
