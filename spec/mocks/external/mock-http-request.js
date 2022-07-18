/**
 * @fileoverview Mock HTTP request class.
 */

/**
 * @typedef {Object} HTTPRequestOpts
 * @prop {string} ip
 * @prop {string} url
 * @prop {string} method
 * @prop {URLSearchParams} query
 * @prop {string} socketRemoteAddr
 * @prop {Object<string, string>} headers
 * @prop {ReturnType<import('forwarded-parse')>} forwardedRecords
 */

export default class MockHTTPRequest {
  /**
   * Constructor for a MockHTTPRequest class.
   * @param {HTTPRequestOpts} opts Options.
   */
  constructor (opts) {
    this.url = opts.url
    this.query = opts.query
    this.method = opts.method
    this.forwardedRecords = opts.forwardedRecords

    this.ip = opts.ip || null
    this.headers = opts.headers || {}

    this.socket = {
      remoteAddress: opts.socketRemoteAddr
    }
  }
}
