/* eslint-env node */
/**
 * @fileoverview Shortcut methods for some crypto operations we'll need to do.
 */

import crypto from 'crypto'

import debugFactory from 'debug'

const debug = debugFactory('colonialwars:crypto')

/**
 * @typedef {Object} Algorithms
 * @prop {string} sha1
 * @prop {string} sha256
 * @prop {string} sha384
 * @prop {string} sha512
 */

/**
 * All the algorithms that can be used when hashing.
 * @type {Algorithms}
 */
export const algorithms = {
  sha1: 'sha1',
  sha256: 'sha256',
  sha384: 'sha384',
  sha512: 'sha512'
}

/**
 * Returns a Uint8Array of random bytes.
 * @param {number} len How many bytes to generate.
 * @returns {Promise<Uint8Array>}
 */
export function randomBytes (len) {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(len, (err, buf) => {
      if (err) {
        reject(err)
        return
      }
      resolve(buf)
    })
  })
}

/**
 * Hashs an ArrayBuffer or ArrayBufferView.
 * @param {ArrayBuffer|ArrayBufferView} data The data to hash.
 * @param {string} alg The algorithm to use.
 * @returns {Promise<ArrayBuffer>}
 */
export function hash (data, alg) {
  return (async () => {
    debug('Creating hash with algorithm %s', alg)
    const hash = crypto.createHash(alg)
    hash.update(new Uint8Array(data))
    const digest = hash.digest()
    return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.length)
  })()
}
