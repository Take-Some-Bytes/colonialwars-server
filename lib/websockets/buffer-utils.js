/* eslint-env node */
/**
 * @fileoverview Utilities to convert a JS string into binary and back.
 */

/**
 * @typedef {Int8Array|Int16Array|Int32Array} IntArrays
 * @typedef {Uint8Array|Uint8ClampedArray|Uint16Array|Uint32Array} UintArrays
 * @typedef {Float32Array|Float64Array} FloatArrays
 * @typedef {BigInt64Array|BigUint64Array} BigIntArrays
 *
 * @typedef {IntArrays|UintArrays|FloatArrays|BigIntArrays} TypedArrays
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

/**
 * Converts a buffer to a base64 string.
 * @param {TypedArrays|ArrayBuffer} buf The buffer to convert to base64.
 * @returns {string}
 */
exports.toBase64 = function toBase64 (buf) {
  return Buffer.from(buf).toString('base64')
}

/**
 * Concatenates a bunch of JS buffers, and returns a new Uint8Array. Will return null
 * if the buffers argument holds no typed arrays. Will return the first buffer converted
 * to a Uint8Array if there is only one buffer.
 * @param {...TypedArrays} buffers The buffers to concatenate.
 * @returns {Uint8Array}
 */
exports.concatBuffers = function concatBuffers (...buffers) {
  const buf = Buffer.concat(...buffers.map(buf => Buffer.from(buf.buffer)))
  return new Uint8Array(buf.buffer.slice(buf.byteOffset))
}
