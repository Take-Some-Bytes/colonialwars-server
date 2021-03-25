/* eslint-env node */
/**
 * @fileoverview Utilities to convert a JS string into binary and back.
 */

/**
 * Converts a string to a Uint32Array, if ``useCodePoint`` is true (since
 * unicode code points are 32 bit unsigned integers), otherwise converts the
 * string into a Uint16Array.
 * @param {string} str The string to convert.
 * @param {boolean} useCodePoint Whether to use Unicode code points.
 * @returns {Uint32Array|Uint16Array}
 */
exports.toBinary = function toBinary (str, useCodePoint) {
  const getCode = useCodePoint
    ? String.prototype.codePointAt
    : String.prototype.charCodeAt

  if (useCodePoint) { return new Uint32Array([...str].map((_, i) => getCode.call(str, i))) }
  return new Uint16Array(str.split('').map((_, i) => getCode.call(str, i)))
}

/**
 * Converts a Uint32Array or a Uint16Array into a JS string.
 * @param {Uint32Array|Uint16Array} bin The Uint32Array or Uint16Array to convert to a string.
 * @param {boolean} useCodePoint Whether to use Unicode code points.
 * @returns {string}
 */
exports.toString = function toString (bin, useCodePoint) {
  const toChar = useCodePoint
    ? String.fromCodePoint
    : String.fromCharCode
  const decodedArr = []

  for (const byte of bin) {
    decodedArr.push(toChar(byte))
  }

  return decodedArr.join('')
}
