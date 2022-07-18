/**
 * @fileoverview Mock Socket.IO Socket class.
 */

import events from 'events'
import crypto from 'crypto'

/**
 * MockSocket class.
 */
export default class MockSocket extends events.EventEmitter {
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
