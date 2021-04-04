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
const WSConn = require('../lib/websockets/conn')
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

// /**
//  * Creates a WebSocket connection
//  */
// function createConnection () {
//   return new WebSocket('http://localhost:2583/?hi=hello', {
//     origin: 'http://localhost:4000',
//     localAddress: '127.0.0.1'
//   })
// }
/**
 * Starts the WSServer and HTTP server.
 * @param {DoneFn} done Done callback.
 */
function startServer (done) {
  wsServer = new WSServer({
    maxConnsPerIP: 1,
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
/**
 * Gets a list of "toggles".
 * @param {WebSocket} ws The WebSocket to work with.
 */
function getToggles (ws) {
  const toggles = {
    hadVerifyClientError: false,
    handshakeTimedout: false,
    rejectedHandshake: false,
    rejectionCode: '',
    verifyClientError: null,
    connTimedout: false,
    connected: false,
    hadError: false,
    err: null
  }
  ws.on('connect', () => {
    toggles.connected = true
  })
  ws.on('open', () => {
    toggles.connected = true
  })
  ws.on('error', ex => {
    toggles.hadError = true
    toggles.err = ex
  })
  ws.on('disconnect', () => {
    toggles.connected = false
  })
  ws.on('close', () => {
    toggles.connected = false
  })
  wsServer.on('rejectedHandshake', (_, code) => {
    toggles.rejectedHandshake = true
    toggles.rejectionCode = code
  })
  wsServer.on('verifyClientError', ex => {
    toggles.hadVerifyClientError = true
    toggles.verifyClientError = ex
  })
  wsServer.on('handshakeTimeout', () => {
    toggles.handshakeTimedout = true
  })
  wsServer.on('connectionError', ex => {
    toggles.hadError = true
    toggles.err = ex
  })
  wsServer.on('connectionTimeout', () => {
    toggles.connTimedout = true
  })
  return toggles
}

// describe('The WSServer class,', () => {
//   it('should construct without error', () => {
//     let err = null

//     try {
//       wsServer = new WSServer({
//         maxConnsPerIP: 3,
//         path: '/',
//         heartBeatInterval: 40000,
//         getClientIP (req) {
//           return req.socket.remoteAddress
//         },
//         handleCors (origin) {
//           return origin && origin === 'http://localhost:4000'
//         },
//         verifyClient (req, cb) {
//           cb(null)
//         }
//       })
//     } catch (ex) {
//       err = ex
//     }

//     expect(err).toBe(null)
//     expect(wsServer).toBeInstanceOf(WSServer)
//     expect(wsServer.wsServer).toBeInstanceOf(WebSocket.Server)
//   })

//   it('should be able to attach to the specified "HTTP server"', () => {
//     const definitelyAHttpServer = new events.EventEmitter()

//     if (wsServer instanceof WSServer) {
//       wsServer.attach(definitelyAHttpServer)
//     }

//     expect(definitelyAHttpServer.listeners('upgrade').length).toBe(1)
//   })

//   describe('when handling new connections,', () => {
//     wsServer = null

//     beforeAll(startServer)
//     afterAll(stopServer)

//     afterEach(() => {
//       wsServer.removeAllListeners()
//     })

//     it('should not try to accept connection if path does not match', done => {
//       const toggles = setUp(new WebSocket('http://localhost:2583/nomatch', {
//         origin: 'http://localhost:4000',
//         localAddress: '127.0.0.1'
//       }))

//       setTimeout(() => {
//         expect(toggles.connected).toBe(false)
//         expect(toggles.rejectedHandshake).toBe(false)
//         expect(toggles.clientIDOnServer).toBe(null)
//         expect(toggles.clientID).toBe(null)
//         expect(toggles.clientHadError).toBe(true)
//         done()
//       }, 100)
//     })

//     it('should not accept connection if CORS does not pass', done => {
//       const toggles = setUp(new WebSocket('http://localhost:2583/', {
//         // The one is the death of the connection.
//         origin: 'http://localhost:4001',
//         localAddress: '127.0.0.1'
//       }))

//       setTimeout(() => {
//         expect(toggles.connected).toBe(false)
//         expect(toggles.rejectedHandshake).toBe(true)
//         expect(toggles.clientIDOnServer).toBe(null)
//         expect(toggles.clientID).toBe(null)
//         expect(toggles.clientHadError).toBe(true)
//         done()
//       }, 100)
//     })

//     it("should not accept connection if verifyClient doesn't pass", done => {
//       const toggles = setUp(new WebSocket('http://localhost:2583/?NOPE=1', {
//         origin: 'http://localhost:4000',
//         localAddress: '127.0.0.1'
//       }))

//       setTimeout(() => {
//         expect(toggles.hadVerifyClientError).toBe(true)
//         expect(toggles.rejectedHandshake).toBe(true)
//         expect(toggles.connected).toBe(false)
//         done()
//       }, 100)
//     })

//     it('should accept a valid connection', done => {
//       const ws = createConnection()
//       const toggles = setUp(ws)

//       setTimeout(() => {
//         expect(toggles.connected).toBe(true)
//         expect(toggles.rejectedHandshake).toBe(false)
//         expect(toggles.clientIDOnServer).toBe(toggles.clientID)
//         expect(toggles.clientHadError).toBe(false)
//         done()
//       }, 100)
//     })

//     it('should not allow too many connections from one IP address', done => {
//       const toggles = setUp(createConnection())

//       setTimeout(() => {
//         expect(toggles.connected).toBe(false)
//         expect(toggles.rejectedHandshake).toBe(true)
//         expect(toggles.clientIDOnServer).toBe(null)
//         expect(toggles.clientID).toBe(null)
//         expect(toggles.clientHadError).toBe(true)
//         done()
//       }, 100)
//     })
//   })

//   describe('when handling idle connections,', () => {
//     wsServer = null

//     beforeAll(startServer)
//     afterAll(stopServer)

//     afterEach(() => {
//       wsServer.removeAllListeners()
//     })

//     it('should terminate connections which do not send a pong packet in the allotted time', done => {
//       const wsConns = [
//         createConnection(),
//         new WebSocket('http://localhost:2583/?hi=hello', {
//           origin: 'http://localhost:4000',
//           localAddress: localIP
//         })
//       ]
//       const togglesArr = wsConns.map(ws => setUp(ws))

//       // 3 seconds should be long enough for both connections to timeout.
//       setTimeout(() => {
//         togglesArr.forEach(toggles => {
//           expect(toggles.connected).toBe(false)
//           expect(toggles.connectionTimedout).toBe(true)
//           expect(toggles.rejectedHandshake).toBe(false)
//           expect(toggles.clientHadError).toBe(false)
//         })
//         done()
//       }, 3500)
//     })

//     it('should not terminate connections which do send a pong packet in the allotted time', done => {
//       const wsConns = [
//         createConnection(),
//         new WebSocket('http://localhost:2583/?hi=hello', {
//           origin: 'http://localhost:4000',
//           localAddress: localIP
//         })
//       ]
//       const togglesArr = wsConns.map(ws => setUp(ws))

//       wsConns.forEach(ws => {
//         ws.on('message', msg => {
//           const string = Buffer.from(msg).toString('utf16le')
//           const parsed = JSON.parse(string)

//           if (parsed && parsed.event && parsed.event === 'wsconn::ping') {
//             ws.send(Buffer.from(JSON.stringify({
//               event: 'wsconn::pong',
//               data: ['PONG']
//             })))
//           }
//         })
//       })

//       // 3 seconds should be long enough for both connections to survive timeout check.
//       setTimeout(() => {
//         togglesArr.forEach(toggles => {
//           expect(toggles.connected).toBe(true)
//           expect(toggles.connectionTimedout).toBe(false)
//           expect(toggles.rejectedHandshake).toBe(false)
//           expect(toggles.clientHadError).toBe(false)
//         })
//         done()
//       }, 3000)
//     })
//   })
// })

describe('The WSServer class,', () => {
  it('should construct without error', () => {
    let err = null

    try {
      wsServer = new WSServer({
        maxConnsPerIP: 3,
        path: '/',
        heartBeatInterval: 40000,
        getClientIP (req) {
          return req.socket.remoteAddress
        },
        handleCors (origin) {
          return origin && origin === 'http://localhost:4000'
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
    beforeAll(startServer)
    afterAll(stopServer)

    it('should not try to accept connection if path does not match', done => {
      const toggles = getToggles(new WebSocket('http://localhost:2583/nomatch'))

      setTimeout(() => {
        expect(toggles.hadError).toBe(true)
        expect(toggles.err).toBeInstanceOf(Error)
        done()
      }, 100)
    })

    it('should not accept connection if subprotocol is not CWDTP', done => {
      const toggles = getToggles(new WebSocket('http://localhost:2583/?hi=hello', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      }))

      setTimeout(() => {
        expect(toggles.rejectionCode).toBe('EINVALPROTO')
        expect(toggles.hadVerifyClientError).toBe(false)
        expect(toggles.handshakeTimedout).toBe(false)
        expect(toggles.rejectedHandshake).toBe(true)
        expect(toggles.verifyClientError).toBe(null)
        expect(toggles.connected).toBe(false)
        expect(toggles.hadError).toBe(true)
        done()
      }, 100)
    })

    it('should not accept connection if CORS does not pass', done => {
      const toggles = getToggles(new WebSocket('http://localhost:2583/?hi=hello', 'pow::cwdtp', {
        // The one is the death of the connection.
        origin: 'http://localhost:4001',
        localAddress: '127.0.0.1'
      }))

      setTimeout(() => {
        expect(toggles.rejectedHandshake).toBe(true)
        expect(toggles.hadError).toBe(true)
        expect(toggles.err).toBeInstanceOf(Error)
        done()
      }, 100)
    })

    it("should not accept connection if verifyClient doesn't pass", done => {
      const toggles = getToggles(new WebSocket('http://localhost:2583/?NOPE=1', 'pow::cwdtp', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      }))

      setTimeout(() => {
        expect(toggles.verifyClientError).toBeInstanceOf(Error)
        expect(toggles.hadVerifyClientError).toBe(true)
        expect(toggles.rejectedHandshake).toBe(true)
        expect(toggles.err).toBeInstanceOf(Error)
        expect(toggles.hadError).toBe(true)
        done()
      }, 100)
    })

    it('should not accept connection if CWDTP handshake does not complete', done => {
      const realTimeout = setTimeout
      jasmine.clock().install()
      const toggles = getToggles(new WebSocket('http://localhost:2583/?hi=hello', 'pow::cwdtp', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      }))

      realTimeout(() => {
        jasmine.clock().tick(31000)
        realTimeout(() => {
          expect(toggles.verifyClientError).toBe(null)
          expect(toggles.handshakeTimedout).toBe(true)
          expect(toggles.hadVerifyClientError).toBe(false)
          expect(toggles.rejectedHandshake).toBe(false)
          expect(toggles.err).toBe(null)
          expect(toggles.hadError).toBe(false)
          expect(toggles.connected).toBe(false)
          jasmine.clock().uninstall()
          done()
        }, 100)
      }, 100)
    })

    it('should accept connection if everything passes', done => {
      const toggles = getToggles(new WSConn('http://localhost:2583/?hi=hello', {
        wsOpts: {
          origin: 'http://localhost:4000',
          localAddress: '127.0.0.1'
        }
      }).ws)

      setTimeout(() => {
        expect(toggles.connected).toBe(true)
        expect(toggles.rejectedHandshake).toBe(false)
        expect(toggles.hadError).toBe(false)
        expect(toggles.hadVerifyClientError).toBe(false)
        expect(toggles.handshakeTimedout).toBe(false)
        expect(toggles.err).toBe(null)
        expect(toggles.verifyClientError).toBe(null)
        done()
      }, 1000)
    })

    it('should not allow too many connections from one IP address', done => {
      const conn = new WSConn('http://localhost:2583/?hi=hello', {
        wsOpts: {
          origin: 'http://localhost:4000',
          localAddress: '127.0.0.1'
        }
      })
      const toggles = getToggles(conn.ws)
      conn.on('error', ex => {
        toggles.hadError = true
        toggles.err = ex
      })

      setTimeout(() => {
        expect(toggles.rejectionCode).toBe('ECONNLIMIT')
        expect(toggles.connected).toBe(false)
        expect(toggles.rejectedHandshake).toBe(true)
        expect(conn.id).toBe(null)
        expect(toggles.hadError).toBe(true)
        expect(toggles.err).toBeInstanceOf(Error)
        done()
      }, 100)
    })
  })

  describe('when handling idle connections,', () => {
    beforeAll(startServer)
    afterAll(stopServer)

    it('should terminate connections which do not send a pong event in the alloted time', done => {
      const conns = [
        new WSConn('http://localhost:2583/?hi=hello', {
          wsOpts: {
            origin: 'http://localhost:4000',
            localAddress: '127.0.0.1'
          }
        }),
        new WSConn('http://localhost:2583/?hi=hello', {
          wsOpts: {
            origin: 'http://localhost:4000',
            localAddress: localIP
          }
        })
      ]
      const togglesArr = conns.map(conn => getToggles(conn))
      conns.forEach(conn => {
        spyOn(conn, 'pong')
      })

      setTimeout(() => {
        togglesArr.forEach(toggles => {
          expect(toggles.connected).toBe(false)
          expect(toggles.connTimedout).toBe(true)
        })
        conns.forEach(conn => {
          expect(conn.pong).toHaveBeenCalled()
        })
        done()
      }, 3500)
    })

    it('should not terminate connections which do send a pong event in the alloted time', done => {
      const conns = [
        new WSConn('http://localhost:2583/?hi=hello', {
          wsOpts: {
            origin: 'http://localhost:4000',
            localAddress: '127.0.0.1'
          }
        }),
        new WSConn('http://localhost:2583/?hi=hello', {
          wsOpts: {
            origin: 'http://localhost:4000',
            localAddress: localIP
          }
        })
      ]
      const togglesArr = conns.map(conn => getToggles(conn))
      conns.forEach(conn => {
        spyOn(conn, 'pong').and.callThrough()
      })

      setTimeout(() => {
        togglesArr.forEach(toggles => {
          expect(toggles.connected).toBe(true)
          expect(toggles.connTimedout).toBe(false)
        })
        conns.forEach(conn => {
          expect(conn.pong).toHaveBeenCalled()
        })
        done()
      }, 3500)
    })
  })
})
