/* eslint-env node */
/**
 * @fileoverview Slight wrapper around the ``ws.Server`` class, which
 * implements the Colonial Wars Data Transfer Protocol.
 */

const util = require('util')
const http = require('http')
const events = require('events')

const debug = require('debug')('colonialwars:wsserver')
const WebSocket = require('ws')

const WSConn = require('./conn')

/**
 * @callback ErrorCallback
 * @param {Error} [error]
 * @returns {void}
 *
 * @callback HandleProtocolsFunc
 * @param {Array<string>} protocols
 * @param {import('http').IncomingMessage} request
 * @returns {string|false}
 *
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
 * @returns {void}
 *
 * @typedef {Object} WSServerOptions
 * @prop {GetClientIPFunc} getClientIP Function to get the client IP. Useful
 * for applications behind proxies.
 * @prop {CorsFunc} handleCors Handles CORS. Return true to allow connection,
 * false to reject.
 * @prop {number} [maxConnsPerIP] The maximum amount of connections allowed per IP.
 * @prop {number} [heartBeatInterval] How often to do a client liveliness check.
 * @prop {VerifyClientFunc} [verifyClient] Function for additional verification
 * of the requested connection before accepting it.
 * @prop {string} [path] The path to accept WebSocket connections on. Default is ``*``.
 * @prop {boolean|WebSocket.PerMessageDeflateOptions} [perMessageDeflate]
 */

/**
 * WSServer class.
 * @extends events.EventEmitter
 */
class WSServer extends events.EventEmitter {
  /**
   * Constructor for a WSServer class.
   * @param {WSServerOptions} opts Options.
   */
  constructor (opts) {
    const {
      path, maxConnsPerIP, perMessageDeflate, heartBeatInterval,
      getClientIP, handleCors, verifyClient
    } = opts
    super()

    this.wsServer = new WebSocket.Server({
      clientTracking: true,
      noServer: true,
      perMessageDeflate,
      path,
      /**
       * @type {HandleProtocolsFunc}
       */
      handleProtocols: () => {
        // We only accept pow.cwdtp.
        return 'pow.cwdtp'
      }
    })

    this.getClientIP = getClientIP
    this.handleCors = handleCors
    this.verifyClient = verifyClient || ((_, cb) => cb(null))

    this.path = path || '*'
    this.maxConnsPerIP = maxConnsPerIP || 20
    this.heartBeatInterval = heartBeatInterval || 20000

    this.heartBeat = null
    /**
     * Map of the number of connections from a single IP.
     * @type {Map<string, number>}
     */
    this.connNumMap = new Map()
    /**
     * Set of current connected clients.
     * @type {Set<InstanceType<WSConn>>}
     */
    this.clients = new Set()

    this._boundHandleUpgrade = this._handleUpgrade.bind(this)
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
    this.heartBeat = setInterval(() => {
      this.clients.forEach(conn => {
        if (!conn.isAlive) {
          debug('Disconnecting connection %s due to ping timeout.', conn.id)
          this.emit('connectionTimeout', conn)
          this.clients.delete(conn)
          conn.disconnect(true, 4004, 'Pong timeout', true)
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

  /**
   * Handles the ``upgrade`` event of a HTTP server.
   * @param {http.Server} server The server that was attached to.
   * @returns {UpgradeHandler}
   * @private
   */
  _handleUpgrade (server) {
    const verifyClient = util.promisify(this.verifyClient)
    /**
     * @param {http.IncomingMessage} req
     * @param {import('net').Socket} socket
     * @param {Buffer} head
     * @returns {Promise<[WebSocket, http.IncomingMessage]>}
     */
    const handleUpgrade = (req, socket, head) => new Promise(resolve => {
      this.wsServer.handleUpgrade(req, socket, head, (ws, req) => {
        resolve([ws, req])
      })
    })
    const shouldHandle = (req, socket) => {
      if (this.path !== '*' && !this.wsServer.shouldHandle(req)) {
        // Let other handlers handle this.
        debug('Not handling upgrade request for URL %s.', req.url)

        // The only listener for upgrade event is ourselves, so
        // don't let the socket hang.
        if (server.listenerCount('upgrade') === 1) {
          rejectHandshake(socket, 404)
          return false
        }
      }
      return true
    }
    /**
     * @param {http.IncomingMessage} req
     * @returns {boolean}
     */
    const usesCWDTP = (req) => {
      const hasWsProto = !!req.headers['sec-websocket-protocol']
      if (!hasWsProto) {
        return false
      }
      const wsProtos = req.headers['sec-websocket-protocol']
        .split(/ *, */)
        .map(proto => proto.trim().toLowerCase())

      if (!wsProtos.includes('pow.cwdtp')) {
        return false
      }
      return true
    }
    const checkConnNum = (clientIP, socket) => {
      const hasConnected = this.connNumMap.has(clientIP)
      if (hasConnected) {
        const currentConns = this.connNumMap.get(clientIP)
        if (currentConns + 1 > this.maxConnsPerIP) {
          debug('Too many connections for IP %s', clientIP)
          rejectHandshake(socket, 403)
          this.emit('rejectedHandshake', clientIP, 'ECONNLIMIT')
          return false
        }
      }
      return true
    }

    return async (req, socket, head) => {
      const clientIP = this.getClientIP(req)
      // Before everything, we gotta check if we're supposed to handle
      // this request.
      if (!shouldHandle(req, socket)) {
        return
      }
      if (!usesCWDTP(req)) {
        rejectHandshake(socket, 400)
        this.emit('rejectedHandshake', clientIP, 'EINVALPROTO')
        return
      }
      // Reject any request which does not use pow.cwdtp.
      // Now check if the IP has connected before.
      if (!checkConnNum(clientIP, socket)) {
        return
      }

      // Next, CORS.
      if (!this.handleCors(req.headers.origin || null)) {
        debug('CORS check failed for IP %s', clientIP)
        rejectHandshake(socket, 403)
        this.emit('rejectedHandshake', clientIP, 'ECORS')
        return
      }

      // Last, user-defined verifyClient function.
      try {
        await verifyClient(req)
      } catch (err) {
        debug('Verifying client %s failed with error %s', clientIP, err.message)
        const status = err.status || err.statusCode || 403
        this.emit('verifyClientError', err)
        rejectHandshake(socket, status)
        this.emit('rejectedHandshake', clientIP, 'EVERIFY')
        return
      }

      const [ws, wsReq] = await handleUpgrade(req, socket, head)
      // Everything passed!
      debug('Upgrade passed. Creating CWDTP connection....')
      const conn = new WSConn(null)
      conn.on('error', ex => {
        if (ex.code === 'EHSTIMEOUT') {
          this.emit('handshakeTimeout', conn)
        } else {
          this.emit('connectionError', ex)
          ws.terminate()
        }
      })
      conn.setWs(ws)
      conn.on('connect', () => {
        conn.removeAllListeners('error')

        debug('Client %s accepted as %s', clientIP, conn.id)

        this.wsServer.emit('connection', ws, wsReq)
        this.emit('connection', conn, wsReq)
        this.clients.add(conn)

        // Set the number of connections for this IP.
        this.connNumMap.set(
          clientIP, this.connNumMap.get(clientIP) + 1 || 1
        )

        conn.on('disconnect', () => {
          debug('Client %s disconnected', conn.id)
          // Gotta update the connection number map after a connection disconnects.
          this.connNumMap.set(clientIP, this.connNumMap.get(clientIP) - 1)
          // We have to do this to avoid having a Map full of ['<ip>', 0].
          if (this.connNumMap.get(clientIP) < 1) {
            this.connNumMap.delete(clientIP)
          }
          this.clients.delete(conn)
        })
      })
    }
  }

  /**
   * Attaches this WSServer to a HTTP server.
   * @param {http.Server} server The HTTP server to attach to.
   */
  attach (server) {
    if (!server || typeof server.on !== 'function') {
      throw new TypeError('Server is not a valid HTTP server!')
    }

    // The following first binds the upgrade handler, then assigns it
    // to this._upgradeHandler, and finally registers it onto the server,
    // all so that we could remove the listener later.
    this._upgradeHandler = this._boundHandleUpgrade(server)
    server.on('upgrade', this._upgradeHandler)

    this._startHeartbeat()
    debug('Attached to server.')
  }

  /**
   * Detaches this WSServer from the specified HTTP server.
   * @param {http.Server} server The HTTP server to detach from.
   */
  detach (server) {
    if (!server || typeof server.off !== 'function') {
      throw new TypeError('Server is not a valid HTTP server!')
    }

    server.off('upgrade', this._upgradeHandler)
    this.disconnectAllClients('Closing server.')
    this._stopHeartbeat()
    this._upgradeHandler = null
    debug('Detached from server.')
  }

  /**
   * Disconnects all clients.
   * @param {string} reason A reason why you're disconnecting all clients.
   */
  disconnectAllClients (reason) {
    this.clients.forEach(conn => {
      // The only reason I can think why you would want to disconnect all
      // clients is that the server is shutting down, so that's why,
      // the status code is hard-coded as 1001.
      conn.disconnect(false, 1001, reason, false)
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

module.exports = exports = WSServer
