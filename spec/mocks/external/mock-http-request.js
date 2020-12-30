/**
 * @fileoverview Mock HTTP request class.
 */

/**
 * @typedef {Object} HTTPRequestOpts
 * @prop {string} ip
 * @prop {string} url
 * @prop {string} method
 * @prop {string} socketRemoteAddr
 * @prop {Object<string, string>} headers
 * @prop {ReturnType<import('forwarded-parse')>} forwardedRecords
 */

class MockHTTPRequest {
  /**
   * Constructor for a MockHTTPRequest class.
   * @param {HTTPRequestOpts} opts Options.
   */
  constructor (opts) {
    this.url = opts.url
    this.method = opts.method
    this.forwardedRecords = opts.forwardedRecords

    this.ip = opts.ip || null
    this.headers = opts.headers || {}

    this.socket = {
      remoteAddress: opts.socketRemoteAddr
    }
  }
}

module.exports = exports = MockHTTPRequest
