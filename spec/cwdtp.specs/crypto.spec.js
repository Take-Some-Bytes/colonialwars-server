/* eslint-env jasmine */
/**
 * @fileoverview Specs for the crypto utility functions that are used by
 * the CWDTP implementation.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const nodeCrypto = require('crypto')
const cwdtpCrypto = require('../../lib/cwdtp/crypto')

/**
 * @param {number} len
 * @returns {Promise<Buffer>}
 */
const nodeRandomBytes = (len) => new Promise((resolve, reject) => {
  nodeCrypto.randomBytes(len, (err, buf) => {
    if (err) {
      reject(err)
      return
    }

    resolve(buf)
  })
})
/**
 * @param {any} buf
 * @param {string} alg
 * @returns {ArrayBuffer}
 */
const nodeHash = (buf, alg) => {
  const hash = nodeCrypto.createHash(alg)
  hash.update(buf)

  const digest = hash.digest()
  return digest
    .buffer
    .slice(digest.byteOffset, digest.byteOffset + digest.length)
}

describe('The CWDTP crypto utility functions,', () => {
  it('should have 2 functions', () => {
    expect(Object.values(cwdtpCrypto)).toHaveSize(2)
  })

  it('should be able to generate some random bytes', async () => {
    const result = await cwdtpCrypto.randomBytes(16)
    const other = await nodeRandomBytes(16)

    // Make sure it's random.
    expect(result).not.toEqual(new Uint8Array(
      other.buffer.slice(
        other.byteOffset, other.byteOffset + other.length
      )
    ))
  })

  it('should be able to hash an array buffer with the specified algorithm', async () => {
    const buf = new Uint16Array(
      'Good morning!'.split('').map(char => {
        return String.prototype.charCodeAt.call(char, 0)
      })
    )
    const result = await cwdtpCrypto.hash(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
      'SHA-1'
    )
    const other = nodeHash(
      new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)),
      'sha1'
    )

    expect(new Uint8Array(result)).toEqual(new Uint8Array(other))
  })
})
