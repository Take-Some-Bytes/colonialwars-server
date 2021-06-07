/* eslint-env node */
/**
 * @fileoverview WSConn class to represent a WebSocket connection,
 * a little bit abstracted.
 */

const nanoid = require('nanoid')
const crypto = require('./crypto')
const events = require('events')

const debug = require('debug')('colonialwars:wsconn')
const WebSocket = require('ws')

const bufferUtils = require('./buffer-utils')

const TYPED_ARRAY_TYPES = {
  int8array: Int8Array,
  uint8array: Uint8Array,
  uint8clampedarray: Uint8ClampedArray,
  int16array: Int16Array,
  uint16array: Uint16Array,
  int32array: Int32Array,
  uint32array: Uint32Array,
  float32array: Float32Array,
  float64array: Float64Array
}
const VALID_PROTOCOL_META_KEYS = [
  'req_key',
  'res_key',
  'reason',
  'error',
  'cid'
]

/**
 * @typedef {Object} WSConnOptions
 * @prop {number} pingTimeout
 * @prop {import('ws').ClientOptions | import('http').ClientRequestArgs} wsOpts Options
 * for the underlying WebSocket instance.
 *
 * @typedef {Object} DecodedMsg
 * @prop {string} event
 * @prop {Record<string, string>} meta
 * @prop {Array<any>} data
 */

/**
 * WSConn class.
 * @extends events.EventEmitter
 */
class WSConn extends events.EventEmitter {
  /**
   * Constructor for a WSConn class.
   * @param {string} url The URL to connect to.
   * @param {WSConnOptions} opts Options.
   */
  constructor (url, opts = {}) {
    super()
    const self = this

    /**
     * @type {(event: string | symbol, ...args: any[]) => boolean}
     */
    this._emit = events.EventEmitter.prototype.emit.bind(this)
    /**
     * @type {string}
     */
    this.id = null
    this.isAlive = false
    if (url === null) {
      // Operate in server mode.
      // The server will have to manually attach a WebSocket instance
      // to this WSConn instance.
      debug('Operating in server mode.')
      this.isClient = false
      this.connected = false
      this.ws = null
    } else {
      // Operate in client mode.
      // Create a new WebSocket to work with.
      debug('Operating in client mode.')
      this.isClient = true
      this.connected = false
      this.pingTimeout = null
      this.pingTimeoutDuration = opts.pingTimeout || 30000
      this.disconnecting = false
      this.abortedHandshake = false
      this.ws = new WebSocket(url, 'pow.cwdtp', opts.wsOpts)
      if (this.ws.readyState === WebSocket.OPEN) {
        this._onOpen()
      }
      this._init()
    }

    this.on('connect', function onConnect () {
      self.isAlive = true
      self.off('connect', onConnect)
    })
  }

  /**
   * Initializes this WSConn.
   * @private
   */
  _init () {
    // Use ArrayBuffer binary type for compatibility between
    // browser and Node.JS
    this.ws.binaryType = 'arraybuffer'
    this.ws.addEventListener('open', () => this._onOpen())
    this.ws.addEventListener('message', e => this._onMessage(e))
    this.ws.addEventListener('error', e => this._emit('error', new Error(e.error)))
    this.ws.addEventListener('close', () => {
      this._onClose()
      this._emit('disconnect')
    })
    this.on('cwdtp::close', msg => {
      if (!msg.isInternal) { return }

      this._emit('disconnecting')
      if (msg.meta && typeof msg.meta.reason === 'string') {
        if (msg.meta.error) {
          this._emit('error', new Error(msg.meta.reason))
        }
        const data = this._encodeMsg(
          'cwdtp::close-ack', {}, []
        )
        this.ws.send(data)
        debug('Sent close acknowledgement packet.')
        this._onClose()
      }
    })

    if (this.isClient) {
      this.on('cwdtp::ping', () => {
        this.clientHeartbeat()
        this.pong()
      })
    } else {
      this.on('cwdtp::pong', () => {
        this.serverHeartbeat()
      })
    }
  }

  /**
   * Encodes a message into the CWDTP format.
   * @param {string} event The event to emit.
   * @param {Record<string, string>} meta Any protocol metadata to send.
   * @param  {...any} data The actual data to send.
   * @returns {Uint16Array}
   * @private
   */
  _encodeMsg (event, meta, ...data) {
    if (!meta || typeof meta !== 'object') {
      meta = {}
    } else if (!Object.keys(meta).every(key => VALID_PROTOCOL_META_KEYS.includes(key))) {
      throw new TypeError('Invalid protocol metadata!')
    }

    const json = JSON.stringify({
      event,
      meta,
      data
    }, (_, val) => {
      // Convert binary data types into arrays with metadata.
      if (val instanceof ArrayBuffer) {
        return {
          binary: true,
          type: 'arraybuffer',
          contents: Array.from(new Uint8Array(val))
        }
      } else if (ArrayBuffer.isView(val)) {
        if (val instanceof DataView) {
          return {
            binary: true,
            type: 'dataview',
            contents: Array.from(new Uint8Array(val.buffer))
          }
        } else {
          return {
            binary: true,
            type: val.constructor.name.toLowerCase(),
            contents: Array.from(new Uint8Array(val.buffer))
          }
        }
      }
      return val
    })

    return bufferUtils.toBinary(json, false)
  }

  /**
   * Decodes a JSON message that conforms to CWDTP.
   * @param {any} msg The message that was received.
   * @returns {DecodedMsg}
   * @private
   */
  _decodeMsg (msg) {
    let strData = ''
    let parsed = null

    // First, convert the message into a JS string.
    if (typeof msg === 'string') {
      strData = msg
    } else if (msg instanceof ArrayBuffer) {
      strData = bufferUtils.toString(new Uint16Array(msg), false)
    } else if (
      typeof Buffer === 'function' &&
      typeof Buffer.isBuffer === 'function' &&
      Buffer.isBuffer(msg)
    ) {
      strData = bufferUtils.toString(new Uint16Array(msg.buffer.slice(msg.byteOffset)), false)
    } else if (ArrayBuffer.isView(msg)) {
      strData = bufferUtils.toString(new Uint16Array(msg.buffer), false)
    } else if (Array.isArray(msg)) {
      strData = bufferUtils.toString(
        new Uint16Array(bufferUtils.concatBuffers(...msg).buffer), false
      )
    } else {
      throw new TypeError('Invalid message data type!')
    }

    parsed = JSON.parse(strData, (_, val) => {
      if (val && val.binary) {
        // Binary data alert!
        if (val.type === 'arraybuffer' || val.type === 'dataview') {
          const buf = new Uint8Array(val.contents).buffer
          if (val.type === 'dataview') {
            return new DataView(buf)
          }
          return buf
        } else if (val.type in TYPED_ARRAY_TYPES) {
          const Constructor = TYPED_ARRAY_TYPES[val.type]
          if (typeof Constructor === 'function') {
            return new Constructor(
              val.contents
            )
          }
        }
      }
      return val
    })

    // Structure validation:
    if (!parsed) { throw new TypeError('Data is non-existent!') }
    if (typeof parsed.event !== 'string') {
      throw new TypeError('Event field does not exist!')
    }
    if (!parsed.meta || (parsed.meta && typeof parsed.meta !== 'object')) {
      throw new TypeError('Metadata does not exist!')
    } else if (!Object.keys(parsed.meta).every(key => VALID_PROTOCOL_META_KEYS.includes(key))) {
      const err = new TypeError('Invalid protocol metadata!')
      err.code = 'EINVALMETA'
      throw err
    }
    if (!parsed.data || !Array.isArray(parsed.data)) {
      throw new TypeError('Data is not an array!')
    }

    return parsed
  }

  /**
   * Private handler for the ``open`` WebSocket event.
   * @private
   */
  _onOpen () {
    if (this.ws.protocol !== 'pow.cwdtp') {
      // Server or client does not speak CWDTP.
      this.terminate(4001, 'Invalid negotiated protocol')
      const err = new Error('Invalid negotiated protocol!')
      err.code = 'EINVALPROTO'
      this._emit('error', err)
      return
    }
    if (this.isClient) {
      this.doClientHandshake().then(() => {
        this.clientHeartbeat()
      }).catch(err => {
        debug('Error occured! %s', err.message)
        this._emit('error', err)
      })
    } else {
      this.doServerHandshake()
      this.serverHeartbeat()
    }
  }

  /**
   * Private handler for the ``message`` WebSocket event.
   * @param {WebSocket.MessageEvent} e The message event.
   * @private
   */
  _onMessage (e) {
    const { data } = e
    let parsed = null
    this._emit('message', data)
    try {
      parsed = this._decodeMsg(data)
    } catch (ex) {
      this._emit('error', new Error(
        `Failed to parse message! Error is: ${ex.message}`
      ))
      return
    }
    if (parsed.event.startsWith('cwdtp::')) {
      this._emit(
        parsed.event, { isInternal: true, meta: parsed.meta, data: null }
      )
      return
    }
    this._emit(
      parsed.event, ...parsed.data
    )
  }

  /**
   * Some common functions to call on connection close.
   * @private
   */
  _onClose () {
    clearTimeout(this.pingTimeout)
    this.pingTimeout = null
    this.isAlive = false
    this.connected = false
  }

  /**
   * Aborts the CWDTP handshake. Automatically closes the underlying WebSocket.
   * @param {string} reason Why you're aborting the handshake.
   */
  abortHandshake (reason) {
    this._emit('abortingHandshake', reason)
    this.disconnect(4000, reason, true)
    this.abortedHandshake = true
  }

  /**
   * Client heartbeat mechanism.
   */
  clientHeartbeat () {
    clearTimeout(this.pingTimeout)
    this.pingTimeout = setTimeout(() => {
      this.terminate(4004, 'Ping timeout')
      this._emit('pingTimeout')
    }, this.pingTimeoutDuration)
  }

  /**
   * Server heartbeat mechanism.
   */
  serverHeartbeat () {
    this.isAlive = true
  }

  /**
   * Do the client handshake for the Colonial Wars Data Transfer Protocol.
   */
  async doClientHandshake () {
    const reqKey = bufferUtils.toBase64(await crypto.randomBytes(8))
    const expected = bufferUtils.toBase64(await crypto.hash(
      bufferUtils.toBinary(reqKey + 'FJcod23c-aodDJf-302-D38cadjeC2381-F8fad-AJD3', false),
      'SHA-1'
    ))
    const data = this._encodeMsg(
      'cwdtp::client-hello', {
        req_key: reqKey
      }, []
    )
    debug('Sending client handshake with req_key %s', reqKey)

    // Send the handshake message.
    this.ws.send(data)

    // Now wait.
    let handshakeTimeout = setTimeout(() => {
      this.terminate(4002, 'Handshake timed out')
      const err = new Error('Handshake timeout')
      err.code = 'EHSTIMEOUT'
      this._emit('error', err)
      this.abortedHandshake = true
      debug('Handshake timed out!')
    }, 30000)
    this.on('cwdtp::server-hello', msg => {
      if (!msg.isInternal) { return }

      clearTimeout(handshakeTimeout)
      handshakeTimeout = null
      debug('Server handshake message received.')
      debug('Received: %s | Expected: %s', msg.meta.res_key, expected)

      if (msg.meta && msg.meta.res_key) {
        if (msg.meta.res_key !== expected) {
          return this.abortHandshake('Invalid response key!')
        } else if (!msg.meta.cid) {
          return this.abortHandshake('No connection ID received!')
        }

        this.id = msg.meta.cid
        this.connected = true
        debug('WSConn %s connected!', this.id)
        this._emit('connect')
        return
      }

      this.abortHandshake('Invalid server handshake response!')
    })
  }

  /**
   * Do the server handshake for the Colonial Wars Data Transfer Protocol.
   */
  doServerHandshake () {
    const cid = nanoid.nanoid(24)
    // Wait.
    let handshakeTimeout = setTimeout(() => {
      this.terminate(4002, 'Handshake timed out')
      debug('Handshake timed out!')
      const err = new Error('Handshake timeout')
      err.code = 'EHSTIMEOUT'
      this._emit('error', err)
    }, 30000)
    this.on('cwdtp::client-hello', async msg => {
      if (!msg.isInternal) { return }

      clearTimeout(handshakeTimeout)
      handshakeTimeout = null
      debug('Client handshake message received with request key: %s', msg.meta.req_key)

      if (msg.meta && msg.meta.req_key) {
        if (typeof msg.meta.req_key !== 'string') {
          return this.abortHandshake('Invalid request key!')
        }
        const hash = bufferUtils.toBase64(await crypto.hash(
          bufferUtils.toBinary(msg.meta.req_key + 'FJcod23c-aodDJf-302-D38cadjeC2381-F8fad-AJD3', false),
          'SHA-1'
        ))
        debug('Sent: %s', hash)

        const data = this._encodeMsg(
          'cwdtp::server-hello', {
            res_key: hash,
            cid: cid
          }, []
        )

        this.ws.send(data)

        this.id = cid
        this.connected = true
        this._emit('connect')
      }
    })
  }

  /**
   * Sets the WebSocket to use if this is a server WSConn.
   * @param {WebSocket} ws The WebSocket to use.
   */
  setWs (ws) {
    if (this.isClient) {
      return
    }

    this.ws = ws
    if (ws.readyState === WebSocket.OPEN) {
      this._onOpen()
    }
    this._init()
  }

  /**
   * Sends an event to the other endpoint.
   * @param {string} event The name of the event.
   * @param  {...any} data The data to send.
   */
  emit (event, ...data) {
    if (!this.connected) {
      throw new Error('WSConn is not connected!')
    }
    const json = this._encodeMsg(event, {}, ...data)
    this.ws.send(json)
  }

  /**
   * Gracefully disconnects this WSConn from the other endpoint.
   * @param {number} code The status code to close the WebSocket with.
   * @param {string} reason A reason why the connection is closing.
   * @param {boolean} wasError Whether the disconnect happened as the result
   * of an error.
   */
  disconnect (code, reason, wasError) {
    debug('Disconnecting WSConn %s', this.id)
    if (!this.connected) {
      // Already disconnected.
      debug('WSConn is not connected')
      return
    }
    this.disconnecting = true
    this._emit('disconnecting', code, reason)
    const closeTimeout = setTimeout(() => {
      debug('Closing handshake timed out!')
      this.ws.close(4003, 'Close handshake timeout')
      this._onClose()
      const err = new Error('Closing handshake timed out')
      err.code = 'ECLOSETIMEOUT'
      this._emit('error', err)
    }, 30000)
    const data = this._encodeMsg(
      'cwdtp::close', {
        error: wasError,
        reason
      }, []
    )
    const onCloseAck = () => {
      clearTimeout(closeTimeout)
      debug('Received close acknowledgement packet.')
      this.off('cwdtp::close-ack', onCloseAck)
      this._onClose()
      this.ws.close(code, reason)
    }

    this.ws.send(data)
    this.on('cwdtp::close-ack', onCloseAck)
  }

  /**
   * Terminates this CWDTP connection--in other words, directly closes the underlying
   * WebSocket connection, and don't bother with the CWDTP closing handshake.
   * @param {number} code The status code to close the WebSocket with.
   * @param {string} reason A reason why the connection is closing.
   */
  terminate (code, reason) {
    this._onClose()
    this.ws.close(code, reason)
  }

  /**
   * Sends a ping to the other endpoint.
   */
  ping () {
    const json = this._encodeMsg(
      'cwdtp::ping', {}, []
    )

    this.ws.send(json)
  }

  /**
   * Sends a pong to the other endpoint.
   */
  pong () {
    const json = this._encodeMsg(
      'cwdtp::pong', {}, []
    )

    this.ws.send(json)
  }
}

module.exports = exports = WSConn
