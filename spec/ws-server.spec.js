/* eslint-env jasmine */
/**
 * @fileoverview Specs for the ``WSServer`` class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const os = require('os')
const http = require('http')
const events = require('events')

const WebSocket = require('ws')
const WSServer = require('../lib/websockets/server')

/**
 * @type {InstanceType<WSServer>}
 */
let wsServer = null
const server = http.createServer((_, res) => {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/plain')
  res.end('404 Not Found.')
})

// Get an IP address to use.
const nets = os.networkInterfaces()
const results = {}

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
    if (net.family === 'IPv4' && !net.internal) {
      if (!results[name]) {
        results[name] = []
      }
      results[name].push(net.address)
    }
  }
}
const localIP = Object.values(results)[0][0]

/**
 * Creates a WebSocket connection
 */
function createConnection () {
  return new WebSocket('http://localhost:2583/?hi=hello', {
    origin: 'http://localhost:4000',
    localAddress: '127.0.0.1'
  })
}
/**
 * Sets up a WebSocket.
 * @param {WebSocket} ws The WebSocket to set up.
 */
function setUp (ws) {
  const toggles = {
    connected: false,
    clientHadError: false,
    rejectedHandshake: false,
    connectionTimedout: false,
    hadVerifyClientError: false,
    conn: null,
    clientID: null,
    clientIDOnServer: null
  }

  wsServer.on('rejectedHandshake', () => {
    toggles.rejectedHandshake = true
  })
  wsServer.on('connection', conn => {
    toggles.clientIDOnServer = conn.id
    toggles.conn = conn
  })
  wsServer.on('verifyClientError', () => {
    toggles.hadVerifyClientError = true
  })
  wsServer.on('connectionTimeout', conn => {
    toggles.connectionTimedout = conn === toggles.conn
  })

  ws.on('open', () => {
    toggles.connected = (ws.readyState === WebSocket.OPEN)
  })
  ws.on('message', msg => {
    const string = Buffer.from(msg).toString('utf16le')
    const parsed = JSON.parse(string)
    toggles.clientID = parsed.data[0].id || toggles.clientID
  })
  ws.on('error', () => {
    toggles.clientHadError = true
  })
  ws.on('close', () => {
    toggles.connected = false
  })

  return toggles
}
/**
 * Starts the WSServer and HTTP server.
 * @param {DoneFn} done Done callback.
 */
function startServer (done) {
  wsServer = new WSServer({
    maxConns: 1,
    path: '/',
    heartBeatInterval: 1500,
    getClientIP (req) {
      return req.socket.remoteAddress
    },
    handleCors (origin) {
      return origin && origin === 'http://localhost:4000'
    },
    verifyClient (req, cb) {
      const query = new URL(req.url, 'http://localhost:2583').search
      if (query !== '?hi=hello') {
        cb(new Error('Invalid query!'))
      }
      cb(null)
    }
  })

  wsServer.attach(server)
  server.listen(2583, 'localhost', done)
  server.on('error', done.fail)
}
/**
 * Stops the WSServer and HTTP server.
 * @param {DoneFn} done Done callback.
 */
function stopServer (done) {
  wsServer.detach(server)
  server.close(err => {
    if (err) return done.fail(err)
    wsServer = null
    done()
  })
}

describe('The WSServer class,', () => {
  it('should construct without error', () => {
    let err = null

    try {
      wsServer = new WSServer({
        maxConns: 3,
        path: '/',
        heartBeatInterval: 40000,
        getClientIP (req) {
          return req.socket.remoteAddress
        },
        handleCors (origin) {
          return origin && origin === 'http://localhost:4000'
        },
        handleProtocols (offers, req) {
          // No protocols for you.
          return false
        },
        verifyClient (req, cb) {
          cb(null)
        }
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(wsServer).toBeInstanceOf(WSServer)
    expect(wsServer.wsServer).toBeInstanceOf(WebSocket.Server)
  })

  it('should be able to attach to the specified "HTTP server"', () => {
    const definitelyAHttpServer = new events.EventEmitter()

    if (wsServer instanceof WSServer) {
      wsServer.attach(definitelyAHttpServer)
    }

    expect(definitelyAHttpServer.listeners('upgrade').length).toBe(1)
  })

  describe('when handling new connections,', () => {
    wsServer = null

    beforeAll(startServer)
    afterAll(stopServer)

    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should not try to accept connection if path does not match', done => {
      const toggles = setUp(new WebSocket('http://localhost:2583/nomatch', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      }))

      setTimeout(() => {
        expect(toggles.connected).toBe(false)
        expect(toggles.rejectedHandshake).toBe(false)
        expect(toggles.clientIDOnServer).toBe(null)
        expect(toggles.clientID).toBe(null)
        expect(toggles.clientHadError).toBe(true)
        done()
      }, 100)
    })

    it('should not accept connection if CORS does not pass', done => {
      const toggles = setUp(new WebSocket('http://localhost:2583/', {
        // The one is the death of the connection.
        origin: 'http://localhost:4001',
        localAddress: '127.0.0.1'
      }))

      setTimeout(() => {
        expect(toggles.connected).toBe(false)
        expect(toggles.rejectedHandshake).toBe(true)
        expect(toggles.clientIDOnServer).toBe(null)
        expect(toggles.clientID).toBe(null)
        expect(toggles.clientHadError).toBe(true)
        done()
      }, 100)
    })

    it("should not accept connection if verifyClient doesn't pass", done => {
      const toggles = setUp(new WebSocket('http://localhost:2583/?NOPE=1', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      }))

      setTimeout(() => {
        expect(toggles.hadVerifyClientError).toBe(true)
        expect(toggles.rejectedHandshake).toBe(true)
        expect(toggles.connected).toBe(false)
        done()
      }, 100)
    })

    it('should accept a valid connection', done => {
      const ws = createConnection()
      const toggles = setUp(ws)

      setTimeout(() => {
        expect(toggles.connected).toBe(true)
        expect(toggles.rejectedHandshake).toBe(false)
        expect(toggles.clientIDOnServer).toBe(toggles.clientID)
        expect(toggles.clientHadError).toBe(false)
        done()
      }, 100)
    })

    it('should not allow too many connections from one IP address', done => {
      const toggles = setUp(createConnection())

      setTimeout(() => {
        expect(toggles.connected).toBe(false)
        expect(toggles.rejectedHandshake).toBe(true)
        expect(toggles.clientIDOnServer).toBe(null)
        expect(toggles.clientID).toBe(null)
        expect(toggles.clientHadError).toBe(true)
        done()
      }, 100)
    })
  })

  describe('when handling idle connections,', () => {
    wsServer = null

    beforeAll(startServer)
    afterAll(stopServer)

    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should terminate connections which do not send a pong packet in the allotted time', done => {
      const wsConns = [
        createConnection(),
        new WebSocket('http://localhost:2583/?hi=hello', {
          origin: 'http://localhost:4000',
          localAddress: localIP
        })
      ]
      const togglesArr = wsConns.map(ws => setUp(ws))

      // 3 seconds should be long enough for both connections to timeout.
      setTimeout(() => {
        togglesArr.forEach(toggles => {
          expect(toggles.connected).toBe(false)
          expect(toggles.connectionTimedout).toBe(true)
          expect(toggles.rejectedHandshake).toBe(false)
          expect(toggles.clientHadError).toBe(false)
        })
        done()
      }, 3500)
    })

    it('should not terminate connections which do send a pong packet in the allotted time', done => {
      const wsConns = [
        createConnection(),
        new WebSocket('http://localhost:2583/?hi=hello', {
          origin: 'http://localhost:4000',
          localAddress: localIP
        })
      ]
      const togglesArr = wsConns.map(ws => setUp(ws))

      wsConns.forEach(ws => {
        ws.on('message', msg => {
          const string = Buffer.from(msg).toString('utf16le')
          const parsed = JSON.parse(string)

          if (parsed && parsed.event && parsed.event === 'wsconn::ping') {
            ws.send(Buffer.from(JSON.stringify({
              event: 'wsconn::pong',
              data: ['PONG']
            })))
          }
        })
      })

      // 3 seconds should be long enough for both connections to survive timeout check.
      setTimeout(() => {
        togglesArr.forEach(toggles => {
          expect(toggles.connected).toBe(true)
          expect(toggles.connectionTimedout).toBe(false)
          expect(toggles.rejectedHandshake).toBe(false)
          expect(toggles.clientHadError).toBe(false)
        })
        done()
      }, 3000)
    })
  })
})
