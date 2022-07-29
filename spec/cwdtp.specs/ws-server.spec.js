/* eslint-env jasmine */
/**
 * @fileoverview Specs for the ``WSServer`` class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import http from 'http'
import events from 'events'
import timers from 'timers'

import WebSocket from 'ws'

import {
  WSConn,
  WSConnState
} from 'colonialwars-lib/cwdtp'
import WSServer from '../../lib/cwdtp/server.js'
import * as errors from '../../lib/cwdtp/errors.js'
import * as crypto from '../../lib/cwdtp/crypto.js'

import getPrivateIp from '../helpers/get-private-ip.js'

/**
 * @type {WSServer}
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
 * Gets a bunch of spies for a WebSocket
 * @param {WebSocket} ws The WebSocket to work with.
 */
function getWsSpies (ws) {
  const spies = {
    wsOpenSpy: jasmine.createSpy('wsOpen', () => {}),
    errorSpy: jasmine.createSpy('error', _err => {})
  }

  ws.on('error', spies.errorSpy)
  ws.on('open', spies.wsOpenSpy)

  return spies
}

/**
 * Gets a bunch of spies for WSServer events.
 */
function getServerSpies () {
  const spies = {
    rejectedHandshakeSpy: jasmine.createSpy('rejectedHandshake', (_ip, _code) => {}),
    verifyClientErrorSpy: jasmine.createSpy('verifyClientError', _err => {}),
    handshakeTimeoutSpy: jasmine.createSpy('handshakeTimeout', _ip => {}),
    connectionErrorSpy: jasmine.createSpy('connectionError', _err => {}),
    cwdtpConnectionSpy: jasmine.createSpy('cwdtpConnection', () => {})
  }

  wsServer.on('rejectedHandshake', spies.rejectedHandshakeSpy)
  wsServer.on('verifyClientError', spies.verifyClientErrorSpy)
  wsServer.on('handshakeTimeout', spies.handshakeTimeoutSpy)
  wsServer.on('connectionError', spies.connectionErrorSpy)
  wsServer.on('connection', spies.cwdtpConnectionSpy)

  return spies
}

describe('The WSServer class,', () => {
  it('should be able to attach to the specified "HTTP server"', () => {
    const definitelyAHttpServer = new events.EventEmitter()

    const wsServer = new WSServer({})

    wsServer.attach(definitelyAHttpServer)

    expect(definitelyAHttpServer.listeners('upgrade')).toHaveSize(1)
  })

  it('should be able to detach from the specified "HTTP server"', () => {
    const definitelyAHttpServer = new events.EventEmitter()

    const wsServer = new WSServer({})

    wsServer.attach(definitelyAHttpServer)

    expect(definitelyAHttpServer.listeners('upgrade')).toHaveSize(1)

    wsServer.detach(definitelyAHttpServer)

    expect(definitelyAHttpServer.listeners('upgrade')).toHaveSize(0)
  })

  describe('when handling new connections,', () => {
    beforeAll(startServer)
    afterAll(stopServer)

    it('should not try to accept connection if path does not match', done => {
      const spies = getWsSpies(new WebSocket('ws://localhost:2583/nomatch'))

      setTimeout(() => {
        expect(spies.errorSpy).toHaveBeenCalled()

        const err = spies.errorSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(Error)

        done()
      }, 50)
    })

    it('should not accept connection if subprotocol is not CWDTP', done => {
      const spies = getWsSpies(new WebSocket('ws://localhost:2583/?hi=hello', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      }))
      const serverSpies = getServerSpies()

      setTimeout(() => {
        expect(spies.errorSpy).toHaveBeenCalled()
        expect(serverSpies.rejectedHandshakeSpy)
          .toHaveBeenCalledOnceWith('127.0.0.1', errors.ServerErrorCodes.INVALID_PROTO)

        done()
      }, 50)
    })

    it('should not accept connection if CORS does not pass', done => {
      const spies = getWsSpies(new WebSocket('ws://localhost:2583/?hi=hello', 'pow.cwdtp', {
        // The one is the death of the connection.
        origin: 'http://localhost:4001',
        localAddress: '127.0.0.1'
      }))
      const serverSpies = getServerSpies()

      setTimeout(() => {
        expect(spies.errorSpy).toHaveBeenCalled()
        expect(serverSpies.rejectedHandshakeSpy)
          .toHaveBeenCalledOnceWith('127.0.0.1', errors.ServerErrorCodes.CORS_FAILED)

        done()
      }, 50)
    })

    it("should not accept connection if verifyClient doesn't pass", done => {
      const spies = getWsSpies(new WebSocket('ws://localhost:2583/?NOPE=1', 'pow.cwdtp', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      }))
      const serverSpies = getServerSpies()

      setTimeout(() => {
        expect(spies.errorSpy).toHaveBeenCalled()
        expect(serverSpies.rejectedHandshakeSpy)
          .toHaveBeenCalledOnceWith('127.0.0.1', errors.ServerErrorCodes.VERIFY_FAILED)
        expect(serverSpies.verifyClientErrorSpy)
          .toHaveBeenCalledOnceWith(new Error('Invalid query!'))

        done()
      }, 50)
    })

    it('should not accept connection if WebSocket handshake fails', done => {
      const req = http.request({
        hostname: 'localhost',
        port: 2583,
        path: '/?hi=hello',
        method: 'GET',
        localAddress: '127.0.0.1'
      })

      const serverSpies = getServerSpies()

      const errSpy = jasmine.createSpy('error')
      const upgradeSpy = jasmine.createSpy('upgrade')
      const responseSpy = jasmine.createSpy('response', _res => {})

      req.on('error', errSpy)
      req.on('upgrade', upgradeSpy)
      req.on('response', responseSpy)

      // All we're missing is a Sec-WebSocket-Key header.
      req.setHeader('Origin', 'http://localhost:4000')
      req.setHeader('Connection', 'upgrade')
      req.setHeader('Upgrade', 'websocket')
      req.setHeader('Sec-WebSocket-Version', '13')
      req.setHeader('Sec-WebSocket-Protocol', 'pow.cwdtp')

      req.end()

      timers.setTimeout(() => {
        expect(errSpy).not.toHaveBeenCalled()
        expect(upgradeSpy).not.toHaveBeenCalled()
        expect(responseSpy).toHaveBeenCalled()

        expect(serverSpies.rejectedHandshakeSpy)
          .toHaveBeenCalledOnceWith('127.0.0.1', errors.ServerErrorCodes.WS_HANDSHAKE_FAILED)

        const res = responseSpy.calls.first().args[0]

        expect(res).toBeInstanceOf(http.IncomingMessage)
        expect(res.statusCode).toBe(400)

        done()
      }, 50)
    })

    it('should not accept connection if CWDTP handshake times out', done => {
      jasmine.clock().install()

      const ws = new WebSocket('ws://localhost:2583/?hi=hello', 'pow.cwdtp', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      })
      const spies = getWsSpies(ws)
      const serverSpies = getServerSpies()

      timers.setTimeout(() => {
        jasmine.clock().tick(40000)
      }, 50)
      timers.setTimeout(() => {
        expect(spies.errorSpy).not.toHaveBeenCalled()
        expect(serverSpies.rejectedHandshakeSpy).not.toHaveBeenCalled()

        expect(spies.wsOpenSpy).toHaveBeenCalled()
        expect(serverSpies.cwdtpConnectionSpy).not.toHaveBeenCalled()

        expect(serverSpies.handshakeTimeoutSpy).toHaveBeenCalled()

        jasmine.clock().uninstall()

        done()
      }, 100)
    })

    it('should not accept connection if CWDTP handshake is invalid', done => {
      const ws = new WebSocket('ws://localhost:2583/?hi=hello', 'pow.cwdtp', {
        origin: 'http://localhost:4000',
        localAddress: '127.0.0.1'
      })
      const spies = getWsSpies(ws)
      const serverSpies = getServerSpies()

      ws.on('open', () => ws.send('NOT VALID CWDTP'))

      timers.setTimeout(() => {
        expect(spies.wsOpenSpy).toHaveBeenCalled()

        expect(spies.errorSpy).not.toHaveBeenCalled()
        expect(serverSpies.handshakeTimeoutSpy).not.toHaveBeenCalled()
        expect(serverSpies.rejectedHandshakeSpy).not.toHaveBeenCalled()

        expect(serverSpies.cwdtpConnectionSpy).not.toHaveBeenCalled()

        expect(serverSpies.connectionErrorSpy).toHaveBeenCalled()

        const err = serverSpies.connectionErrorSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(errors.HandshakeError)
        expect(err.code).toBe(errors.HandshakeErrorCode.INVALID_CWDTP_MSG)

        done()
      }, 50)
    })

    it('should accept connection if everything passes', done => {
      const conn = new WSConn('ws://localhost:2583/?hi=hello', {
        crypto,
        createWs: (url, protocols) => {
          return new WebSocket(url, protocols, {
            origin: 'http://localhost:4000',
            localAddress: '127.0.0.1'
          })
        }
      })
      const serverSpies = getServerSpies()

      timers.setTimeout(() => {
        const spies = getWsSpies(conn._ws)

        expect(conn.state).toBe(WSConnState.OPEN)
        expect(conn._ws.readyState).toBe(WebSocket.OPEN)

        expect(serverSpies.cwdtpConnectionSpy).toHaveBeenCalled()

        expect(spies.errorSpy).not.toHaveBeenCalled()
        expect(serverSpies.rejectedHandshakeSpy).not.toHaveBeenCalled()
        expect(serverSpies.verifyClientErrorSpy).not.toHaveBeenCalled()

        conn.disconnect(1001, 'Exiting test item')

        done()
      }, 50)
    })
  })

  describe('when handling idle connections,', () => {
    beforeAll(startServer)
    afterAll(stopServer)

    it('should terminate connections which do not send a pong event in the alloted time', done => {
      const conns = [
        new WSConn('ws://localhost:2583/?hi=hello', {
          crypto,
          createWs: (url, protocols) => {
            return new WebSocket(url, protocols, {
              origin: 'http://localhost:4000',
              localAddress: '127.0.0.1'
            })
          }
        }),
        new WSConn('ws://localhost:2583/?hi=hello', {
          crypto,
          createWs: (url, protocols) => {
            return new WebSocket(url, protocols, {
              origin: 'http://localhost:4000',
              localAddress: localIP
            })
          }
        })
      ]

      const openSpy = jasmine.createSpy('connect', () => {})
      const connectionTimeoutSpy = jasmine.createSpy('connectionTimeoutSpy', _connId => {})
      conns.forEach(conn => {
        conn.on('open', openSpy)
        spyOn(conn, 'pong')
      })

      wsServer.on('connectionTimeout', connectionTimeoutSpy)

      jasmine.clock().install()

      // Force the server to set up the heartbeat mechanism again.
      wsServer._startHeartbeat()

      timers.setTimeout(() => {
        expect(openSpy).toHaveBeenCalledTimes(2)

        jasmine.clock().tick(1500)
      }, 50)
      timers.setTimeout(() => {
        jasmine.clock().tick(1500)
        jasmine.clock().uninstall()
      }, 100)

      timers.setTimeout(() => {
        conns.forEach(conn => {
          expect(conn._ws.readyState).toBe(WebSocket.CLOSED)
          expect(conn.pong).toHaveBeenCalled()
        })

        expect(connectionTimeoutSpy).toHaveBeenCalledTimes(2)

        done()
      }, 150)
    })

    it('should not terminate connections which do send a pong event in the alloted time', done => {
      const conns = [
        new WSConn('ws://localhost:2583/?hi=hello', {
          crypto,
          createWs: (url, protocols) => {
            return new WebSocket(url, protocols, {
              origin: 'http://localhost:4000',
              localAddress: '127.0.0.1'
            })
          }
        }),
        new WSConn('ws://localhost:2583/?hi=hello', {
          crypto,
          createWs: (url, protocols) => {
            return new WebSocket(url, protocols, {
              origin: 'http://localhost:4000',
              localAddress: localIP
            })
          }
        })
      ]

      const openSpy = jasmine.createSpy('connect', () => {})
      const connectionTimeoutSpy = jasmine.createSpy('connectionTimeoutSpy', _connId => {})

      conns.forEach(conn => {
        conn.on('open', openSpy)
        spyOn(conn, 'pong').and.callThrough()
      })

      wsServer.on('connectionTimeout', connectionTimeoutSpy)

      jasmine.clock().install()

      // Force the server to set up the heartbeat mechanism again.
      wsServer._startHeartbeat()

      timers.setTimeout(() => {
        expect(openSpy).toHaveBeenCalledTimes(2)

        jasmine.clock().tick(1500)
      }, 50)
      timers.setTimeout(() => {
        jasmine.clock().tick(1500)
        jasmine.clock().uninstall()
      }, 100)

      timers.setTimeout(() => {
        conns.forEach(conn => {
          expect(conn.state).toBe(WSConnState.OPEN)
          expect(conn.pong).toHaveBeenCalled()

          conn.disconnect(1001, 'Exiting test item')
        })

        expect(connectionTimeoutSpy).toHaveBeenCalledTimes(0)

        done()
      }, 150)
    })
  })
})
