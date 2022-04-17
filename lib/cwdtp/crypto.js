/* eslint-env node */
/**
 * @fileoverview Shortcut methods for some crypto operations we'll need to do.
 */

const crypto = require('crypto')
const debug = require('debug')('colonialwars:crypto')

/**
 * Returns a Uint8Array of random bytes.
 * @param {number} len How many bytes to generate.
 * @returns {Promise<Uint8Array>}
 */
exports.randomBytes = function randomBytes (len) {
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
 * @param {'SHA-1'|'SHA-256'|'SHA-384'|'SHA-512'} alg The algorithm to use.
 * @returns {Promise<ArrayBuffer>}
 */
exports.hash = function hash (data, alg) {
  const algs = {
    'SHA-1': 'sha1',
    'SHA-256': 'sha256',
    'SHA-384': 'sha384',
    'SHA-512': 'sha512'
  }
  return (async () => {
    debug('Creating hash with algorithm %s', algs[alg])
    const hash = crypto.createHash(algs[alg])
    hash.update(new Uint8Array(data))
    const digest = hash.digest()
    return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.length)
  })()
}
