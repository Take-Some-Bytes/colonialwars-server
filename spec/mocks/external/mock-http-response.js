/**
 * @fileoverview Mock HTTP response class.
 */

import stream from 'stream'

/**
 * @callback WritableCallback
 * @param {Error|null} [err]
 * @returns {void}
 */

export default class MockHTTPResponse extends stream.Writable {
  /**
   * Constructor for a MockHTTPResponse class.
   * @param {stream.WritableOptions} opts Options.
   */
  constructor (opts) {
    super(opts)

    this._headers = {}
    this.statusCode = 200
    this.response = null
  }

  /**
   * Gets the headers stored in thie class.
   * @returns {Object<string, string|Array<string>>}
   */
  get headers () {
    const _headers = {}
    Object.keys(this._headers).forEach(key => {
      const strKey = String(key)
      const val = this._headers[key]

      // Check if val is an array. If it is, we gotta leave it alone.
      if (val instanceof Array) {
        _headers[strKey] = val
      } else {
        _headers[strKey] = String(val)
      }
    })

    return _headers
  }

  /**
   * Gets the response stored in this class.
   * @returns {*}
   */
  get responseContent () {
    if (!(this.response instanceof Array)) {
      return this.response
    }
    return Buffer.concat(this.response)
  }

  /**
   * Implementation of Node.JS Writable stream `_write()` method.
   * @param {Buffer|string|any} chunk The chunk to write.
   * @param {string} encoding The encoding of the chunk.
   * @param {WritableCallback} callback Callback.
   */
  _write (chunk, encoding, callback) {
    if (!(this.response instanceof Array)) {
      this.response = []
    }
    if (typeof chunk !== 'string' && !(chunk instanceof Buffer)) {
      callback(new TypeError(
        `Expected chunk-type Buffer or string, received ${typeof chunk}`
      ))
      return
    }
    if (typeof chunk === 'string') {
      chunk = Buffer.from(
        chunk, encoding
      )
    }
    if (this.response instanceof Array && chunk instanceof Buffer) {
      this.response.push(chunk)
      callback(null)
      return
    }
    callback(new Error(
      'Failed to write chunk!'
    ))
  }

  /**
   * "Sets" a header.
   * @param {string} name The name of the header. Must be a string.
   * @param {any} val The value of the header. Could be anything, but will be
   * converted to a string for when you get the headers.
   */
  setHeader (name, val) {
    this._headers[name] = val
  }
}
