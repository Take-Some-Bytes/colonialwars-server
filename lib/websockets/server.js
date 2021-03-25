/* eslint-env node */
/**
 * @fileoverview Slight wrapper around the ``ws.Server`` class.
 */

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
 * @prop {number} maxConns The maximum amount of connections allowed per IP.
 * @prop {number} heartBeatInterval How often to do a client liveliness check.
 * @prop {CorsFunc} handleCors Handles CORS. Return true to allow connection,
 * false to reject.
 * @prop {GetClientIPFunc} getClientIP Function to get the client IP. Useful
 * for applications behind proxies.
 * @prop {HandleProtocolsFunc} handleProtocols
 * @prop {VerifyClientFunc} [verifyClient] Function for additional verification
 * of the requested connection before accepting it.
 * @prop {string} [path] The path to accept WebSocket connections on. Default is ``*``.
 * @prop {boolean|WebSocket.PerMessageDeflateOptions} perMessageDeflate
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
      path, maxConns, heartBeatInterval, perMessageDeflate,
      handleCors, handleProtocols,
      getClientIP, verifyClient
    } = opts
    super()

    this.wsServer = new WebSocket.Server({
      clientTracking: true,
      noServer: true,
      perMessageDeflate,
      handleProtocols,
      path
    })
    this.getClientIP = getClientIP
    this.handleCors = handleCors

    this.path = path || '*'
    this.maxConnections = maxConns || 20
    this.heartBeatInterval = heartBeatInterval || 20000
    this.verifyClient = verifyClient || ((req, cb) => { cb(null) })

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
          conn.disconnect(true)
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
   * @private
   */
  _handleUpgrade (server) {
    /**
     * TODO: Fix the following code to avoid 'indentation hell'.
     * The current code below has way too much indentation.
     * We should see if we could fix some if it with Promises and such.
     * (20/03/2021) Take-Some-Bytes */
    return (req, socket, head) => {
      // Before everything, we gotta check if we're supposed to handle
      // this request.
      if (this.path !== '*' && !this.wsServer.shouldHandle(req)) {
        // Let other handlers handle this.
        debug('Not handling upgrade request for URL %s.', req.url)

        // The only listener for upgrade event is ourselves, so
        // don't let the socket hang.
        if (server.listenerCount('upgrade') === 1) {
          this.rejectHandshake(socket, 404)
        }
        return
      }

      // First check if the client has connected before.
      const clientIP = this.getClientIP(req)
      const hasConnected = this.connNumMap.has(clientIP)
      if (hasConnected) {
        const currentConns = this.connNumMap.get(clientIP)
        if (currentConns + 1 > this.maxConnections) {
          debug('Too many connections for IP %s', clientIP)
          this.rejectHandshake(socket, 403)
          this.emit('rejectedHandshake', clientIP, 'ECONNLIMIT')
          return
        }
      }
      // Next, CORS.
      const allow = this.handleCors(req.headers.origin || null)
      if (!allow) {
        debug('CORS check failed for IP %s', clientIP)
        this.rejectHandshake(socket, 403)
        this.emit('rejectedHandshake', clientIP, 'ECORS')
        return
      }
      // Last, user-defined verifyClient function.
      if (typeof this.verifyClient === 'function') {
        this.verifyClient(req, err => {
          if (err) {
            debug('Verifying client %s failed.', clientIP)
            const status = err.status || err.statusCode || 403
            this.emit('verifyClientError', err)
            this.rejectHandshake(socket, status)
            this.emit('rejectedHandshake', clientIP, 'EVERIFY')
            return
          }

          this.wsServer.handleUpgrade(req, socket, head, async ws => {
            // Everything passed!
            const conn = new WSConn(ws, {})
            await conn.getAndSendID()

            debug('Client %s accepted as %s', clientIP, conn.id)

            this.wsServer.emit('connection', ws)
            this.emit('connection', conn)
            this.clients.add(conn)

            // Set the number of connections for this IP.
            this.connNumMap.set(
              clientIP, this.connNumMap.get(clientIP) + 1 || 1
            )

            conn.on('disconnect', () => {
              // Gotta update the connection number map after a connection disconnects.
              this.connNumMap.set(clientIP, this.connNumMap.get(clientIP) - 1)
              // We have to do this to avoid having a Map full of ['<ip>', 0].
              if (this.connNumMap.get(clientIP) < 1) {
                this.connNumMap.delete(clientIP)
              }
            })
          })
        })
      }
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
   * Detaches this WSServer to the specified HTTP server.
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
   * Rejects a client's WebSocket handshake.
   * @param {import('net').Socket} socket The net.Socket to write on.
   * @param {number} status The HTTP status code to reject with.
   */
  rejectHandshake (socket, status) {
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

  /**
   * Disconnects all clients.
   * @param {string} reason A reason why you're disconnecting all clients.
   */
  disconnectAllClients (reason) {
    this.clients.forEach(conn => {
      // The only reason I can think why you would want to disconnect all
      // clients is that the server is shutting down, so that's why,
      // the status code is hard-coded as 1001.
      conn.disconnect(false, 1001, reason)
    })
  }
}

module.exports = exports = WSServer
