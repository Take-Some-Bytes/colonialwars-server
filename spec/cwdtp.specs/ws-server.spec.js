/* eslint-env jasmine */
/**
 * @fileoverview Specs for the ``WSServer`` class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const http = require('http')
const events = require('events')

const WebSocket = require('ws')
const WSConn = require('../../lib/cwdtp/conn')
const WSServer = require('../../lib/cwdtp/server')

const getPrivateIp = require('../helpers/get-private-ip')

/**
 * @type {InstanceType<WSServer>}
 */
let wsServer = null
const server = http.createServer((_, res) => {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/plain')
  res.end('404 Not Found.')
})

const localIP = getPrivateIp()

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
      const toggles = getToggles(new WebSocket('ws://localhost:2583/nomatch'))

      setTimeout(() => {
        expect(toggles.hadError).toBe(true)
        expect(toggles.err).toBeInstanceOf(Error)
        done()
      }, 100)
    })

    it('should not accept connection if subprotocol is not CWDTP', done => {
      const toggles = getToggles(new WebSocket('ws://localhost:2583/?hi=hello', {
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
      const toggles = getToggles(new WebSocket('ws://localhost:2583/?hi=hello', 'pow.cwdtp', {
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
      const toggles = getToggles(new WebSocket('ws://localhost:2583/?NOPE=1', 'pow.cwdtp', {
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
      const ws = new WebSocket('ws://localhost:2583/?hi=hello', 'pow.cwdtp', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      })
      const toggles = getToggles(ws)

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
          // ws.terminate()
          done()
        }, 100)
      }, 100)
    })

    it('should accept connection if everything passes', done => {
      const conn = new WSConn('ws://localhost:2583/?hi=hello', {
        wsOpts: {
          origin: 'http://localhost:4000',
          localAddress: '127.0.0.1'
        }
      })
      const toggles = getToggles(conn.ws)

      setTimeout(() => {
        expect(conn.connected).toBe(true)
        expect(conn.ws.readyState === WebSocket.OPEN).toBe(true)
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
      const conn = new WSConn('ws://localhost:2583/?hi=hello', {
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
        new WSConn('ws://localhost:2583/?hi=hello', {
          wsOpts: {
            origin: 'http://localhost:4000',
            localAddress: '127.0.0.1'
          }
        }),
        new WSConn('ws://localhost:2583/?hi=hello', {
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
        togglesArr.forEach((toggles, i) => {
          expect(conns[i].connected).toBe(false)
          expect(toggles.connTimedout).toBe(true)
        })
        conns.forEach(conn => {
          expect(conn.pong).toHaveBeenCalled()
        })
        conns.forEach(conn => {
          conn.disconnect(false, 1001, 'Exiting test item')
        })
        done()
      }, 3500)
    })

    it('should not terminate connections which do send a pong event in the alloted time', done => {
      const conns = [
        new WSConn('ws://localhost:2583/?hi=hello', {
          wsOpts: {
            origin: 'http://localhost:4000',
            localAddress: '127.0.0.1'
          }
        }),
        new WSConn('ws://localhost:2583/?hi=hello', {
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
        togglesArr.forEach((toggles, i) => {
          expect(conns[i].connected).toBe(true)
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
