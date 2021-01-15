/* eslint-env node */
/**
 * @fileoverview Additional utility functions to mess around with math.
 */

/**
 * Bounds a number to the given minimum and maximum, inclusive of both bounds.
 * This function will still work if ``min`` and ``max`` are switched.
 * @param {number} val The value to check
 * @param {number} min The minimum bound.
 * @param {number} max The maximum bound.
 */
function bound (val, min, max) {
  if (min > max) { return Math.min(min, Math.max(max, val)) }
  return Math.min(max, Math.max(min, val))
}
/**
 * Returns a boolean representing whether the given value is between the minimum
 * and maximum, inclusive of both bounds. This function will still work if
 * ``min`` and ``max`` are switched.
 * @param {number} val The value to check.
 * @param {number} min The minimum bound.
 * @param {number} max The maximum bound.
 */
function inBound (val, min, max) {
  if (min > max) { return val >= max && val <= min }
  return val >= min && val <= max
}
/**
 * Converts an angle in degrees to an angle in radians.
 * @param {number} theta The angle to convert.
 * @returns {number}
 */
function degToRad (theta) {
  return theta * (Math.PI / 180)
}
/**
 * Converts an angle in radians to an angle in degrees.
 * @param {number} theta The angle to convert.
 * @returns {number}
 */
function radToDeg (theta) {
  return theta * (180 / Math.PI)
}

module.exports = exports = {
  bound,
  inBound,
  degToRad,
  radToDeg
}
