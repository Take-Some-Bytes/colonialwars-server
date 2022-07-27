/* eslint-env node */
/**
 * @fileoverview WSConn class to represent a WebSocket connection,
 * a little bit abstracted.
 */

import events from 'events'

import debugFactory from 'debug'
import WebSocket from 'ws'

import {
  ClientHandshake,
  ServerHandshake,
  ReservedEvents,
  encodeMsg,
  decodeMsg,
  HandshakeState
} from 'colonialwars-lib/cwdtp-engine'

import * as crypto from './crypto.js'
import * as errors from './errors.js'

const debug = debugFactory('colonialwars:wsconn')

/**
 * @typedef {Object} WSConnOptions
 * @prop {number} pingTimeout
 * @prop {import('ws').ClientOptions|import('http').ClientRequestArgs} wsOpts Options
 * for the underlying WebSocket instance.
 */

/**
 * All the states a WSConn can be in.
 */
export const WSConnState = {
  OPENING: Symbol('kOpening'),
  OPEN: Symbol('kOpen'),
  CLOSING: Symbol('kClosing'),
  CLOSED: Symbol('kClosed'),
  TIMED_OUT: Symbol('kTimedOut'),
  ERROR: Symbol('kError'),
  // :)
  BISCUIT: Symbol('kBiscuit')
}

/**
 * WSConn class.
 */
export default class WSConn extends events.EventEmitter {
  /**
   * Constructor for a WSConn class.
   * @param {string|null} url The URL to connect to.
   * @param {WSConnOptions} opts Options.
   */
  constructor (url, opts = {}) {
    super()

    /**
     * The ID of this WSConn.
     *
     * This will be null if the WSConn is not connected.
     * @type {string|null}
     */
    this.id = null
    this.isAlive = false
    /**
     * The current state of the WSConn.
     * @type {symbol}
     */
    this.state = WSConnState.OPENING
    /**
     * An emitter where the events of messages are going to be broadcasted.
     *
     * This is to avoid conflict with built-in WSConn events.
     * @type {events.EventEmitter}
     */
    this.messages = new events.EventEmitter()
    this.messages.on = (event, listener) => {
      _validateEventName(event)

      events.EventEmitter.prototype.on.call(this.messages, event, listener)
    }
    /**
     * An emitter where all reserved events are broadcasted.
     * @type {events.EventEmitter}
     * @private
     */
    this._reservedMsgs = new events.EventEmitter()
    /**
     * The WebSocket to use for communcations.
     * @type {WebSocket}
     * @private
     */
    this._ws = null

    if (url === null) {
      // Operate in server mode.
      // The server will have to manually attach a WebSocket instance
      // to this WSConn instance.
      debug('Operating in server mode')

      this.isClient = false
    } else {
      // Operate in client mode.
      // Create a new WebSocket to work with.
      debug('Operating in client mode')

      this.isClient = true

      /**
       * @type {NodeJS.Timeout|null}
       * @private
       */
      this._pingTimeout = null
      /**
       * @type {number}
       * @private
       */
      this._pingTimeoutDuration = opts.pingTimeout || 30000

      // Set up the websocket
      const ws = new WebSocket(url, 'pow.cwdtp', opts.wsOpts)
      ws.on('error', err => {
        this.state = WSConnState.ERROR
        this.emit('error', err)
      })
      ws.on('open', () => {
        ws.removeAllListeners('error')

        debug('Client websocket opened')

        this.setWs(ws)
      })
    }
  }

  // ============ Private event handling ============ //

  /**
   * Private handler for when the WebSocket closes.
   * @param {number} code The closure code.
   * @param {Buffer} reason A reason why the WebSocket is closing.
   * @private
   */
  _onWsClose (code, reason) {
    let decodedReason
    try {
      decodedReason = _decodeBuf(reason)
    } catch (ex) {
      // swallow
    }

    switch (this.state) {
      case WSConnState.OPENING:
        // Connection forcefully closed before connecting.
        this.state = WSConnState.ERROR
        this.emit('error', new errors.ConnectionReset())
        break
      case WSConnState.OPEN:
        // Forceful closure of a CWDTP connection.
        debug(
          'WSConn %s forcefully closed with code %s and reason "%s"',
          this.id, code, reason
        )

        this.state = WSConnState.CLOSED
        this.emit('close', true, decodedReason)
        break
      default:
        // Either the CWDTP connection is already closed,
        // or you're going crazy.
    }
  }

  /**
   * Private handler for when a CWDTP close initiator is received.
   * @param {Record<string, string>} meta Protocol metadata.
   * @private
   */
  _onCwdtpClose (meta) {
    if (
      this.state !== WSConnState.OPEN &&
      // Don't question it.
      this.state !== WSConnState.BISCUIT
    ) {
      throw new Error('Close initiator received, but connection is not open!')
    }

    debug('Close initiator received')

    this._ws.send(encodeMsg(ReservedEvents.CLOSE_ACK))

    this.state = WSConnState.CLOSING
    this.emit('closing', meta.reason)

    this.state = WSConnState.CLOSED
    this.emit('close', meta.error, meta.reason)
  }

  /**
   * Private handler for when binary data is received.
   * @param {ArrayBuffer|Buffer} buf The binary data.
   * @private
   */
  _onBinary (buf) {
    // ``buf`` should always be text.
    debug(
      'Unexpected binary message on WSConn %s: %O',
      this.id, buf
    )

    this.state = WSConnState.ERROR
    this.emit('error', new errors.InvalidMsgError(
      'Unexpected binary message!',
      errors.InvalidMsgErrorCode.UNEXPECTED_BINARY
    ))
  }

  /**
   * Private handler for WebSocket message events.
   * @param {ArrayBuffer|Buffer} buf The message data.
   * @param {boolean} isBinary Whether the data is from a binary frame.
   * @private
   */
  _onMessage (buf, isBinary) {
    // ``buf`` should always be text.
    if (isBinary) {
      this._onBinary(buf)

      return
    }

    const data = _decodeBuf(buf)
    let parsed = null

    try {
      parsed = decodeMsg(data)
    } catch (ex) {
      debug('Invalid CWDTP message! Error is: %s', ex.stack)

      this.state = WSConnState.ERROR
      this.emit('error', new errors.InvalidMsgError(
        'Invalid CWDTP message!',
        errors.InvalidMsgErrorCode.INVALID_CWDTP
      ))

      return
    }

    if (Object.values(ReservedEvents).includes(parsed.event)) {
      // Reserved event
      this._reservedMsgs.emit(parsed.event, parsed.meta)
      return
    }

    // User event.
    this.messages.emit(parsed.event, ...parsed.data)
  }

  /**
   * Private handler for when the CWDTP handshake finishes.
   * @param {string} id The connection ID.
   * @private
   */
  _onHandshakeFinish (id) {
    this.id = id
    this.state = WSConnState.OPEN

    debug('Handshake for WSConn %s finished', this.id)

    // === Message handler === //
    this._ws.on('message', this._onMessage.bind(this))

    // === Liveliness handler === //
    if (this.isClient) {
      this._reservedMsgs.on(ReservedEvents.PING, () => {
        this._clientHeartbeat()

        this.pong()
      })

      // Start waiting for a ping.
      this._clientHeartbeat()
    } else {
      this._reservedMsgs.on(ReservedEvents.PONG, () => {
        this._serverHeartBeat()
      })

      // Start the connection as "alive"
      this._serverHeartBeat()
    }

    this.emit('open')
  }

  // ============ Private heartbeat ============ //

  /**
   * Heartbeat handler for client connections.
   *
   * This method sets up a timeout which waits on pings from the server. It will
   * set the ``.isAlive`` property to false if the timeout executes, while also
   * emitting a "timeout" event.
   * @private
   */
  _clientHeartbeat () {
    clearTimeout(this._pingTimeout)

    this.isAlive = true

    this._pingTimeout = setTimeout(() => {
      this.isAlive = false

      this.emit('pingTimeout')
      this.terminate(4004, 'Ping timeout')
    }, this._pingTimeoutDuration)
  }

  /**
   * Heartbeat handler for server connections.
   *
   * This method literally just sets ``conn.isAlive`` to true.
   * @private
   */
  _serverHeartBeat () {
    this.isAlive = true
  }

  // ============ Private handshake ============ //

  /**
   * Do the client handshake for the Colonial Wars Data Transfer Protocol.
   * @private
   */
  _clientHandshake () {
    const hs = new ClientHandshake({
      crypto,
      // 30 seconds
      timeout: 30000
    })

    debug('Started client handshake')

    hs.on('timeout', () => {
      this.state = WSConnState.TIMED_OUT
      this.emit('handshakeTimeout')
    })
    hs.on('error', err => {
      this.state = WSConnState.ERROR
      this.emit('error', err)
    })
    hs.on('finish', this._onHandshakeFinish.bind(this))

    hs.initiate().then(clientHello => {
      this._ws.once('message', (buf, isBinary) => {
        // ``buf`` should always be text.
        if (isBinary) {
          debug(
            'Unexpected binary message on WSConn %s: %O',
            this.id, buf
          )

          this._onBinary(buf)

          return
        }

        const data = _decodeBuf(buf)
        const ack = hs.respond(data)
        if (!ack) {
          // There was an error.
          return
        }

        // Send the server-hello ack.
        this._ws.send(ack)
      })

      this._ws.send(clientHello)
    })
  }

  /**
   * Do the server handshake for the Colonial Wars Data Transfer Protocol.
   * @private
   */
  _serverHandshake () {
    const self = this
    const hs = new ServerHandshake({
      crypto,
      // 30 seconds
      timeout: 30000
    })

    debug('Started server handshake')

    hs.on('timeout', () => {
      this.state = WSConnState.TIMED_OUT
      this.emit('handshakeTimeout')
    })
    hs.on('error', err => {
      this.state = WSConnState.ERROR
      this.emit('error', err)
    })
    hs.on('finish', this._onHandshakeFinish.bind(this))

    // Wait for the first message.
    hs.wait()

    this._ws.on('message', async function onMsg (buf, isBinary) {
      // ``buf`` should always be text.
      if (isBinary) {
        debug(
          'Unexpected binary message on WSConn %s: %O',
          self.id, buf
        )

        self._onBinary(buf)

        return
      }

      const data = _decodeBuf(buf)

      switch (hs.state) {
        // Receive client hello.
        case HandshakeState.WAITING: {
          const res = await hs.hello(data)
          if (!res) {
            // There was an error.
            self._ws.off('message', onMsg)
            return
          }

          self._ws.send(res)
          break
        }
        // Receive server hello ack.
        case HandshakeState.WAITING_FOR_ACK: {
          hs.acknowledge(data)

          self._ws.off('message', onMsg)
          break
        }
        default:
          throw new Error('Invalid handshake state!')
      }
    })
  }

  // ============ Public server connection handling ============ //

  /**
   * Sets this WSConn's websocket to the one provided.
   *
   * This will fail if the WebSocket's readyState is not ``WebSocket.OPEN``.
   *
   * This method will immediate start waiting for the arrival of a client-hello
   * message.
   * @param {WebSocket} ws The WebSocket to use.
   */
  setWs (ws) {
    if (ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket must be connected!')
    }
    if (this._ws instanceof WebSocket) {
      throw new Error('WebSocket already set!')
    }
    // Shouldn't happen, but doesn't hurt to check.
    if (this.state !== WSConnState.OPENING) {
      throw new Error('WSConn already connected!')
    }

    this._ws = ws

    if (this._ws.protocol !== 'pow.cwdtp') {
      // Server or client does not speak CWDTP.

      this.state = WSConnState.ERROR
      this.emit('error', new errors.InvalidProtocolError(
        'Invalid negotiated protocol!'
      ))

      return
    }

    // Use ArrayBuffer binary type for consistency between
    // browser and Node.JS
    this._ws.binaryType = 'arraybuffer'
    this._ws.on('error', e => {
      this.state = WSConnState.ERROR
      this.emit('error', e)
    })
    this._ws.on('close', this._onWsClose.bind(this))

    // Set up close initiator handler
    this._reservedMsgs.on(ReservedEvents.CLOSE, this._onCwdtpClose.bind(this))

    if (this.isClient) {
      this._clientHandshake()
    } else {
      this._serverHandshake()
    }
  }

  // ============ Public message sending ============ //

  /**
   * Sends a CWDTP event to the other endpoint.
   * @param {string} event The name of the event to send.
   * @param  {...any} data Any data to send along with the event.
   */
  send (event, ...data) {
    if (typeof event !== 'string') {
      throw new TypeError('Event must be a string!')
    }

    _validateEventName(event)

    if (
      this.state !== WSConnState.OPEN &&
      // Don't question it.
      this.state !== WSConnState.BISCUIT
    ) {
      throw new errors.NotConnectedError('WSConn is not connected!')
    }

    this._ws.send(encodeMsg(event, {}, ...data))
  }

  // ============ Public disconnection ============ //

  /**
   * Gracefully disconnects this WSConn from the other endpoint.
   * @param {number} code The status code to close the WebSocket with.
   * @param {string} reason A reason why the connection is closing.
   * @param {{ error: boolean }} [opts] Whether the connection closed as the
   * result of an error.
   */
  disconnect (code, reason, opts = { error: false }) {
    debug(
      'Disconnecting WSConn %s with code %s and reason "%s"',
      this.id, code, reason
    )

    if (this.state !== WSConnState.OPEN) {
      throw new errors.NotConnectedError('WSConn is not connected!')
    }

    this.state = WSConnState.CLOSING
    this.emit('closing', reason)

    const closeTimeout = setTimeout(() => {
      debug('Closing handshake timed out for WSConn %s', this.id)

      this._ws.close(4004, 'Closing handshake timeout')

      this.state = WSConnState.TIMED_OUT

      this.emit('closeTimeout')
      this.emit('close', true, 'Close timeout')
    }, 30000)

    this._reservedMsgs.once(ReservedEvents.CLOSE_ACK, () => {
      clearTimeout(closeTimeout)

      debug('Received close acknowledgement packet for WSConn %s', this.id)

      this.state = WSConnState.CLOSED

      this.emit('close', opts.error, reason)
      this._ws.close(code, reason)
    })

    this._ws.send(encodeMsg(ReservedEvents.CLOSE, {
      error: opts.error,
      reason
    }))
  }

  /**
   * Terminates this CWDTP connection--in other words, directly closes the underlying
   * WebSocket connection, and don't bother with the CWDTP closing handshake.
   *
   * This method ALWAYS assumes an error occured.
   * @param {number} code The status code to close the WebSocket with.
   * @param {string} reason A reason why the connection is closing.
   */
  terminate (code, reason) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new errors.NotConnectedError('WebSocket is not connected!')
    }

    // this.state = WSConnState.CLOSING
    // this.emit('closing', reason)

    this.state = WSConnState.CLOSED
    this.emit('close', true, reason)

    this._ws.close(code, reason)
  }

  // ============ Public ping/pong ============ //

  /**
   * Sends a ping to the other endpoint.
   */
  ping () {
    this._ws.send(encodeMsg(ReservedEvents.PING))
  }

  /**
   * Sends a pong to the other endpoint.
   */
  pong () {
    this._ws.send(encodeMsg(ReservedEvents.PONG))
  }
}

/**
 * Validates an event name. Throws an error if it's not valid.
 * @param {string} event The event name to validate.
 */
function _validateEventName (event) {
  if (!event) {
    // Empty event name.
    throw new errors.InvalidEventName(
      'Event name cannot be empty!',
      errors.InvalidEventNameCode.EMPTY_EVENT_NAME
    )
  }
  if (Object.values(ReservedEvents).includes(event)) {
    throw new errors.InvalidEventName(
      'Cannot send a message with a reserved event name!',
      errors.InvalidEventNameCode.RESERVED_EVENT
    )
  }
}

/**
 * Decodes a Buffer or ArrayBuffer into a string, as UTF-8.
 * @param {Buffer|ArrayBuffer} buf The buffer to decode.
 * @returns {string}
 */
function _decodeBuf (buf) {
  const asUint8 = (() => {
    if (Buffer.isBuffer(buf)) {
      return new Uint8Array(buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.length
      ))
    }
    if (buf instanceof ArrayBuffer) {
      return new Uint8Array(buf)
    }

    throw new TypeError('buf parameter must be a Buffer or an ArrayBuffer!')
  })()

  return new TextDecoder().decode(asUint8)
}
