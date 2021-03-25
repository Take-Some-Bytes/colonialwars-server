/* eslint-env node */
/**
 * @fileoverview WSConn class to represent a WebSocket connection,
 * a little bit abstracted.
 */

const crypto = require('crypto')
const events = require('events')

const debug = require('debug')('colonialwars:wsconn')
const WebSocket = require('ws')

const stringUtils = require('./string-utils')

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

/**
 * @typedef {Object} WSConnOptions
 * @prop {string} ip The IP of this connection.
 * @prop {boolean} reconnect Whether to try to reconnect.
 * @prop {number} [reconnectionLimit] The maximum amount of times to try to reconnect.
 * @prop {number} [reconnectionDelay] The amount of time to wait before trying to reconnect.
 * @prop {boolean} isClient Whether this WSConn is being used on the client side.
 * @prop {number} [heartbeatInterval] How often to a ping is sent.
 * @prop {number} [heartbeatTimeout] The timeout for waiting for a ping.
 * @prop {() => Promise<string>} [getID] A function to get a unique ID for this WSConn. Must be asynchronous.
 */

/**
 * WSConn class.
 * @extends events.EventEmitter
 */
class WSConn extends events.EventEmitter {
  /**
   * Constructor for a WSConn class. This wraps a W3C compliant
   * WebSocket instance.
   * @param {WebSocket} ws The actual WebSocket to wrap.
   * @param {WSConnOptions} opts Options
   */
  constructor (ws, opts) {
    const {
      isClient, reconnect,
      reconnectionLimit, reconnectionDelay,
      heartbeatInterval, heartbeatTimeout,
      getID
    } = opts
    super()

    if (!(ws instanceof WebSocket)) {
      throw new TypeError('The ws parameter must be an instance of WebSocket!')
    }
    if (!isClient) {
      if (typeof getID !== 'function') {
        /**
         * @returns {Promise<string>}
         */
        this.getID = () => {
          return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
              if (err) {
                reject(err)
                return
              }

              resolve(buf.toString('base64'))
            })
          })
        }
      } else {
        this.getID = getID
      }
    }

    // this.ip = ip
    this.isClient = isClient
    this.reconnect = reconnect
    this.reconnects = 0
    this.reconnectionLimit = reconnectionLimit || 20
    this.reconnectionDelay = reconnectionDelay || 1000
    this.pingTimeoutDuration =
      (
        (heartbeatInterval || 20000) + (heartbeatTimeout || 10000)
      ) || 30000
    /**
     * Private emit method. Does not send to the other endpoint.
     * @type {(event: string | symbol, ...args: any[]) => boolean}
     * @private
     */
    this._emit = events.EventEmitter.prototype.emit.bind(this)

    this.pingTimeout = null
    this.connected = false
    this.isAlive = false
    this.id = null

    this._bindHandlers()
    this.attach(ws)
  }

  /**
   * Binds the event handlers of this WSConn.
   */
  _bindHandlers () {
    this._onOpen = this._onOpen.bind(this)
    this._onMessage = this._onMessage.bind(this)
    this._onError = this._onError.bind(this)
    this._onClose = this._onClose.bind(this)
  }

  /**
   * Private handler for the ``'open'`` WebSocket event.
   * @private
   */
  _onOpen () {
    this.connected = true

    if (this.isClient) {
      this.clientHeartbeat()
    } else {
      this.serverHeartbeat()
    }

    this._emit('connect')
  }

  /**
   * Private handler for the ``'close'`` WebSocket event.
   * @param {{
   * wasClean: boolean;
   * code: number;
   * reason: string;
   * target: WebSocket;
   * }} e The close event.
   */
  _onClose (e) {
    const { code, reason } = e
    this.isAlive = false
    this.connected = false
    this._emit('disconnect', code, reason)

    clearTimeout(this.pingTimeout)
    this.pingTimeout = null
  }

  /**
   * Private handler for the ``'error'`` WebSocket event.
   * @param {{
   * error: any;
   * message: any;
   * type: string;
   * target: WebSocket;
   * }} e The error event.
   */
  _onError (e) {
    const { error: err, message } = e
    this._emit('error', err, message)
  }

  /**
   * Private handler for the ``'message'`` WebSocket event.
   * @param {{
   * data: any;
   * type: string;
   * target: WebSocket;
   * }} e The message event.
   * @private
   */
  _onMessage (e) {
    const { data } = e
    this._emit('message', data)
    this._parseMessage(data)
  }

  /**
   * Parses a WebSocket message.
   * @param {WebSocket.Data} data The data that was received.
   * @private
   */
  _parseMessage (data) {
    let stringData = ''
    let parsedData = null
    if (typeof data === 'string') {
      stringData = data
    } else if (Array.isArray(data)) {
      stringData = stringUtils.toString(
        Buffer.concat(data), false
      )
    } else if (data instanceof ArrayBuffer) {
      stringData = stringUtils.toString(
        new Uint16Array(data), false
      )
    } else {
      stringData = stringUtils.toString(
        data, false
      )
    }

    try {
      parsedData = JSON.parse(stringData, (key, val) => {
        if (val.binary && val.type === 'arraybuffer') {
          return new Uint8Array(val.content).buffer
        }
        if (val.binary && val.type in TYPED_ARRAY_TYPES) {
          const Constructor = TYPED_ARRAY_TYPES[val.type]
          // Binary arrays are always transported as Uint8Arrays.
          const arr = new Uint8Array(val.content)
          return new Constructor(arr.buffer)
        }

        return val
      })
      if (!parsedData || !parsedData.event) {
        throw new Error('Invalid JSON structure!')
      }
    } catch (ex) {
      debug('Error while parsing message %O', ex)
      this.disconnect(false, 1002, 'Message structure incorrect!')
      this._emit('error', ex)
      return
    }

    this._emit(parsedData.event, ...parsedData.data)
  }

  /**
   * Sets up the reconnection logic for this WSConn.
   * @private
   */
  _setUpReconnect () {
    this.on('disconnect', code => {
      debug('Trying to reconnect!')
      if (code === 1000) {
        // The connection closed normally.
        debug('Not attempting reconnect due to normal closure.')
      } else if (this.reconnects + 1 > this.reconnectionLimit) {
        // TOO MANY RECONNECTS!!!
        debug('Maximum reconnections attempts reached.')
      } else {
        const delay = this.reconnectionDelay * (this.reconnects + 1)
        this.reconnects++
        debug(delay)
        debug(this.reconnects)

        // Welp, now we gotta create a new WebSocket and do all sorts of fun stuff.
        setTimeout(() => {
          this.detach(this.ws)
          const ws = new WebSocket(this.ws.url, [this.ws.protocol])
          this.ws = null
          this.attach(ws)
        }, delay)
      }
    })
  }

  /**
   * Attaches this WSConn to a WebSocket instance.
   * @param {WebSocket} ws The WebSocket to attach to.
   */
  attach (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      this._onOpen()
    } else {
      ws.addEventListener('open', this._onOpen)
    }
    ws.addEventListener('close', this._onClose)
    ws.addEventListener('message', this._onMessage)
    ws.addEventListener('error', this._onError)

    this.ws = ws

    if (this.isClient) {
      this.on('wsconn::ping', () => {
        this.clientHeartbeat()
        this.pong()
      })
      this.on('wsconn::id', data => {
        this.id = data.id
      })
      if (this.reconnect) {
        this._setUpReconnect()
      }
    } else {
      this.on('wsconn::pong', () => this.serverHeartbeat())
    }
  }

  /**
   * Detaches this WSConn from a WebSocket instance.
   * @param {WebSocket} ws The WebSocket to detach from.
   */
  detach (ws) {
    ws.removeEventListener('open', this._onOpen)
    ws.removeEventListener('close', this._onClose)
    ws.removeEventListener('message', this._onMessage)
    ws.removeEventListener('error', this._onError)

    this.removeAllListeners('wsconn::id')
    this.removeAllListeners('wsconn::ping')
    this.removeAllListeners('wsconn::pong')
    this.removeAllListeners('disconnect')
  }

  /**
   * Resets the heartbeat mechanism for the client.
   */
  clientHeartbeat () {
    clearTimeout(this.pingTimeout)
    this.pingTimeout = setTimeout(() => {
      this.disconnect(true)
    }, this.pingTimeoutDuration)
  }

  /**
   * Server heartbeat mechanism.
   */
  serverHeartbeat () {
    this.isAlive = true
  }

  /**
   * Disconnects this WSConn.
   * @param {boolean} force Whether to force the disconnect (i.e. use ``ws.terminate``).
   * @param {number} code The status code for closing the connection.
   * @param {string} reason The reason why this WSConn was disconnected, if ``force`` was
   * false.
   */
  disconnect (force, code, reason) {
    if (force) {
      debug('Terminating WSConn %s', this.id)
      this.ws.terminate()
    } else {
      debug('Closing WSConn %s with code %d and reason %s', this.id, code, reason)
      this.ws.close(code, reason)
    }

    this.connected = false
  }

  /**
   * Sends an event to the other endpoint.
   * @param {string} event The name of the event to emit.
   * @param  {...any} data The data to send.
   */
  emit (event, ...data) {
    let cb = data.pop()
    if (typeof cb !== 'function') {
      data.push(cb)
      cb = () => { /* no-op */ }
    }

    this.ws.send(stringUtils.toBinary(
      JSON.stringify({
        event,
        data
      }, (key, val) => {
        if (val instanceof ArrayBuffer) {
          return {
            type: 'arraybuffer',
            binary: true,
            as: 'uint8array',
            content: Array.from(new Uint8Array(val))
          }
        }
        if (ArrayBuffer.isView(val) && !(val instanceof DataView)) {
          return {
            type: val.constructor.name.toLowerCase(),
            binary: true,
            as: 'uint8array',
            content: Array.from(new Uint8Array(val.buffer))
          }
        }

        return val
      })
    ), cb)
  }

  /**
   * Send a ping to the client. Does nothing if this WSConn
   * is a client connection.
   */
  ping () {
    if (!this.isClient) {
      this.emit('wsconn::ping', stringUtils.toBinary('PING'))
    }
  }

  /**
   * Send a pong to the server. Does nothing if this WSConn is
   * a server connection.
   */
  pong () {
    if (this.isClient) {
      this.emit('wsconn::pong', stringUtils.toBinary('PONG'))
    }
  }

  /**
   * Gets and sends the client a connection ID if this is
   * a server and if this connection doesn't already have an ID.
   * Only returns the existing connection ID if this is a client connection.
   * @returns {Promise<string>}
   */
  async getAndSendID () {
    if (!this.id && !this.isClient) {
      this.id = await this.getID()
      this.emit('wsconn::id', { id: this.id })
    }
    return this.id
  }
}

module.exports = exports = WSConn
