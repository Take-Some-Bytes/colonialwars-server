/* eslint-env node */
/**
 * @fileoverview Slight wrapper around the ``ws.Server`` class for handling CWDTP
 * connections.
 */

import util from 'util'
import http from 'http'
import events from 'events'

import debugFactory from 'debug'
import { WebSocketServer } from 'ws'

import WSConn from './conn.js'
import { ServerErrorCodes } from './errors.js'

const debug = debugFactory('colonialwars:wsserver')

/**
 * @callback GetClientIPFunc
 * @param {http.IncomingMessage} req
 * @returns {string}
 *
 * @callback CorsFunc
 * @param {string} origin
 * @returns {boolean}
 *
 * @callback VerifyClientFunc
 * @param {http.IncomingMessage} req
 * @param {ErrorCallback} cb Call this callback with null to allow the connection.
 * @returns {void}
 *
 * @callback UpgradeHandler
 * @param {http.IncomingMessage} req
 * @param {import('net').Socket} socket
 * @param {Buffer} head
 * @returns {Promise<void>}
 */

/**
 * @typedef {Object} WSServerOptions
 * @prop {GetClientIPFunc} getClientIP Function to get the client IP.
 *
 * Useful for applications behind proxies. Most errors emitted will contain the
 * client IP returned from this function, for error handling and logging purposes.
 *
 * @prop {CorsFunc} handleCors Handles CORS. Return true to allow connection,
 * false to reject.
 *
 * @prop {number} [heartBeatInterval=60] How often to do a client liveliness check.
 *
 * Default is 1 minute (60 seconds).
 *
 * @prop {VerifyClientFunc} [verifyClient] Function for additional verification
 * of the requested connection before accepting it.
 *
 * The function provided should call the ``cb`` parameter with an error if
 * verification fails. Otherwise, it should call ``cb`` with null.
 *
 * @prop {string} [path='*'] The path to accept WebSocket connections on.
 *
 * Default is ``*``.
 *
 * @prop {boolean|WebSocket.PerMessageDeflateOptions} [perMessageDeflate]
 */

/**
 * Slight wrapper around the ``ws.Server`` class for handling CWDTP
 * connections.
 */
export default class WSServer extends events.EventEmitter {
  /**
   * Create a new WSServer class.
   * @param {WSServerOptions} opts Options.
   */
  constructor (opts) {
    super()

    const {
      path, perMessageDeflate, heartBeatInterval,
      getClientIP, handleCors, verifyClient
    } = opts

    this._wsServer = new WebSocketServer({
      clientTracking: true,
      noServer: true,
      perMessageDeflate,
      path,
      handleProtocols: protos => {
        if (!protos.has('pow.cwdtp')) {
          return
        }

        // We only accept pow.cwdtp.
        return 'pow.cwdtp'
      }
    })

    this.getClientIP = getClientIP
    this.handleCors = handleCors
    this.verifyClient = verifyClient || ((_, cb) => cb(null))

    this.path = path || '*'
    this.heartBeatInterval = heartBeatInterval || 20000

    this._heartBeat = null
    /**
     * Set of current connected clients.
     * @type {Set<WSConn>}
     */
    this.clients = new Set()

    /**
     * Reference to the current upgrade handler so we can remove it later.
     */
    this._upgradeHandler = null
  }

  /**
   * Starts up the server heartbeat mechanism.
   * @private
   */
  _startHeartbeat () {
    this._heartBeat = setInterval(() => {
      this.clients.forEach(conn => {
        if (!conn.isAlive) {
          debug('Disconnecting connection %s due to pong timeout.', conn.id)
          this.emit('connectionTimeout', conn)
          this.clients.delete(conn)

          conn.terminate(4004, 'Pong timeout')
          return
        }

        conn.isAlive = false
        conn.ping()
      })
    }, this.heartBeatInterval)
  }

  /**
   * Stops the server heartbeat mechanism.
   * @private
   */
  _stopHeartbeat () {
    clearInterval(this.heartBeat)
    this.heartBeat = null
  }

  // ============ Private create upgrade handler ============ //

  /**
   * Creates an upgrade handler for the specified server.
   *
   * The returned upgrade handler will attempt to establish a CWDTP connection
   * with all clients which upgrade to websockets.
   * @param {http.Server} server The server to create the upgrade handler for.
   * @returns {UpgradeHandler}
   * @private
   */
  _createUpgradeHandler (server) {
    /**
     * A map of all the WebSocket upgrade requests and their respective
     * ``reject`` callbacks.
     * @type {Map<http.IncomingMessage, (reason?: any) => void>}
     */
    const rejectionQueue = new Map()
    /**
     * Checks if we should handle this upgrade request.
     * @param {http.IncomingMessage} req The request to check.
     * @returns {boolean}
     */
    const shouldHandle = req => {
      return this.path === '*' || this._wsServer.shouldHandle(req)
    }
    /**
     * Returns true if the given request asks for the CWDTP sub-protocol.
     * @param {http.IncomingMessage} req
     * @returns {boolean}
     */
    const usesCWDTP = (req) => {
      const hasWsProto = !!req.headers['sec-websocket-protocol']
      if (!hasWsProto) {
        return false
      }
      const wsProtos = req.headers['sec-websocket-protocol']
        .split(',')
        .map(proto => proto.trim())

      return wsProtos.includes('pow.cwdtp')
    }
    /**
     * Handles the WebSocket upgrade.
     * @param {http.IncomingMessage} req
     * @param {import('net').Socket} socket
     * @param {Buffer} head
     * @returns {Promise<[WebSocket, http.IncomingMessage]>}
     */
    const handleWsUpgrade = (req, socket, head) => new Promise((resolve, reject) => {
      rejectionQueue.set(req, reject)

      this._wsServer.handleUpgrade(req, socket, head, (ws, req) => {
        rejectionQueue.delete(req)
        resolve([ws, req])
      })
    })
    const verifyClient = util.promisify(this.verifyClient)

    // Handle WebSocket upgrade errors
    this._wsServer.on('wsClientError', (err, _socket, req) => {
      rejectionQueue.get(req)(err)
      rejectionQueue.delete(req)
    })

    return async (req, socket, head) => {
      const clientIP = this.getClientIP(req)

      // Path matching
      if (!shouldHandle(req)) {
        debug('Not handling upgrade request for URL %s.', req.url)

        if (server.listeners('upgrade').length !== 1) {
          // Let other handlers handle this request.
          return
        }

        // We're the only handler registered.
        // Send a 404.
        rejectHandshake(socket, 404)
        return
      }
      // Sub-protocol check
      if (!usesCWDTP(req)) {
        debug('Upgrade request from %s did not request CWDTP!', clientIP)

        rejectHandshake(socket, 400)

        this.emit('rejectedHandshake', clientIP, ServerErrorCodes.INVALID_PROTO)

        return
      }
      // CORS check
      if (!this.handleCors(req.headers.origin || null)) {
        debug('Upgrade request from %s failed CORS check', clientIP)

        rejectHandshake(socket, 403)

        this.emit('rejectedHandshake', clientIP, ServerErrorCodes.CORS_FAILED)

        return
      }
      // User-provided request check
      try {
        await verifyClient(req)
      } catch (err) {
        debug(
          'Upgrade request from %s failed verification with error %s',
          clientIP, err
        )

        const status = err.status || err.statusCode || 403

        this.emit('verifyClientError', err)

        rejectHandshake(socket, status)

        this.emit('rejectedHandshake', clientIP, ServerErrorCodes.VERIFY_FAILED)
        return
      }

      // Now, attempt the WebSocket handshake.
      let ws = null
      let wsReq = null

      try {
        [ws, wsReq] = await handleWsUpgrade(req, socket, head)
      } catch (err) {
        debug(
          'Upgrade request from %s failed websocket handshake with error %s',
          clientIP, err
        )

        rejectHandshake(socket, 400)

        this.emit('rejectedHandshake', clientIP, ServerErrorCodes.WS_HANDSHAKE_FAILED)

        return
      }

      // Lastly, attempt the CWDTP handshake.
      const conn = new WSConn(null)
      conn.setWs(ws)

      conn.on('handshakeTimeout', () => {
        this.emit('handshakeTimeout', clientIP)
        conn.terminate(4002, '')
      })
      conn.on('error', err => {
        this.emit('connectionError', err)
        conn.terminate(1002, err.message)
      })
      conn.on('open', () => {
        conn.removeAllListeners('error')
        conn.removeAllListeners('handshakeTimeout')

        debug('Connection from %s accepted as client %s', clientIP, conn.id)

        this._wsServer.emit('connection', ws, wsReq)
        this.emit('connection', conn, wsReq)

        this.clients.add(conn)
      })
      conn.on('close', () => {
        debug('Client %s disconnected', conn.id)

        this.clients.delete(conn)
      })
    }
  }

  // ============ Public attach/detach ============ //

  /**
   * Attaches this WSServer to a HTTP server.
   * @param {http.Server} server The HTTP server to attach to.
   */
  attach (server) {
    if (!server || typeof server.on !== 'function') {
      throw new TypeError('Server is not a valid HTTP server!')
    }

    this._upgradeHandler = this._createUpgradeHandler(server).bind(this)
    this._startHeartbeat()

    server.on('upgrade', this._upgradeHandler)

    debug('Attached to server.')
  }

  /**
   * Detaches this WSServer from the specified HTTP server.
   *
   * This function immediately attempts to disconnect all clients which have
   * established a CWDTP connection.
   * @param {http.Server} server The HTTP server to detach from.
   */
  detach (server) {
    if (!server || typeof server.off !== 'function') {
      throw new TypeError('Server is not a valid HTTP server!')
    }

    server.off('upgrade', this._upgradeHandler)

    this.disconnectAllClients('Closing server')

    this._stopHeartbeat()
    this._upgradeHandler = null

    debug('Detached from server.')
  }

  // ============ Public client disconnect-all ============ //

  /**
   * Disconnects all clients.
   * @param {string} reason A reason why you're disconnecting all clients.
   */
  disconnectAllClients (reason) {
    this.clients.forEach(conn => {
      // The only reason I can think why you would want to disconnect all
      // clients is that the server is shutting down, so that's why,
      // the status code is hard-coded as 1001.
      conn.disconnect(1001, reason)
    })
  }
}

/**
 * Rejects a client's WebSocket handshake.
 * @param {import('net').Socket} socket The net.Socket to write on.
 * @param {number} status The HTTP status code to reject with.
 */
function rejectHandshake (socket, status) {
  if (!socket.writable) { return }
  let statusMsg = `${status} ${http.STATUS_CODES[status]}`

  if (!statusMsg) {
    statusMsg = '500 Internal Server Error'
  }

  debug('Rejecting socket with status %s', statusMsg)

  socket.write([
    `HTTP/1.1 ${statusMsg}`,
    'Connection: close',
    `Date: ${new Date().toUTCString()}`,
    '\r\n'
  ].join('\r\n'))
  socket.destroy()
}
