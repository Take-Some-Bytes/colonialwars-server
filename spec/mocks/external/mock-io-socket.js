/**
 * @fileoverview Mock Socket.IO Socket class.
 */

const events = require('events')
const crypto = require('crypto')

/**
 * MockSocket class.
 */
class MockSocket extends events.EventEmitter {
  /**
   * Constructor for a MockSocket class.
   * @param {string} id A unique ID for this MockSocket.
   */
  constructor (id) {
    super()
    this.id = id
  }

  /**
   * Factory method for a MockSocket class.
   * @returns {MockSocket}
   */
  static create () {
    const id = crypto.randomBytes(16).toString('base64')
    return new MockSocket(id)
  }
}

module.exports = exports = MockSocket
