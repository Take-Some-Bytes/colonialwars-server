/* eslint-env jasmine */
/**
 * @fileoverview Specs for testing the WSConn when handling closing and opening
 * CWDTP handshakes.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import http from 'http'
import timers from 'timers'

import WebSocket, { WebSocketServer } from 'ws'

import { MagicString } from 'colonialwars-lib/cwdtp-engine'
import * as helpers from '../helpers/cwdtp-helpers.js'

import * as crypto from '../../lib/cwdtp/crypto.js'
import * as errors from '../../lib/cwdtp/errors.js'
import WSConn, { WSConnState } from '../../lib/cwdtp/conn.js'

const server = http.createServer((_, res) => {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/plain')
  res.end('Not Found.')
})
const encoder = new TextEncoder()
const wsServer = new WebSocketServer({
  server,
  handleProtocols: () => {
    return 'pow.cwdtp'
  }
})

describe('The WSConn class,', () => {
  describe('when connecting to a client,', () => {
    beforeAll(done => {
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(helpers.createTearDown(server, wsServer))
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should time out if client-hello is not received', done => {
      wsServer.on('connection', ws => {
        jasmine.clock().install()

        const handshakeTimeoutSpy = jasmine.createSpy('handshakeTimeout', () => {})
        const conn = new WSConn(null)

        conn.on('handshakeTimeout', handshakeTimeoutSpy)
        conn.setWs(ws)

        jasmine.clock().tick(40000)

        expect(conn.id).toBeNull()
        expect(conn.state).toBe(WSConnState.TIMED_OUT)
        expect(handshakeTimeoutSpy).toHaveBeenCalled()

        jasmine.clock().uninstall()

        done()
      })

      // eslint-disable-next-line no-new
      new WebSocket('ws://localhost:3820', 'pow.cwdtp')
    })

    it('should time out if server-hello-ack is not received', done => {
      wsServer.on('connection', ws => {
        jasmine.clock().install()

        const handshakeTimeoutSpy = jasmine.createSpy('timeout', () => {})
        const conn = new WSConn(null)

        conn.on('handshakeTimeout', handshakeTimeoutSpy)
        conn.setWs(ws)

        timers.setTimeout(() => {
          jasmine.clock().tick(40000)

          expect(conn.id).toBeNull()
          expect(conn.state).toBe(WSConnState.TIMED_OUT)
          expect(handshakeTimeoutSpy).toHaveBeenCalled()

          jasmine.clock().uninstall()

          done()
        }, 50)
      })

      const client = new WebSocket('ws://localhost:3820', 'pow.cwdtp')
      client.on('open', () => {
        client.send(JSON.stringify({
          event: 'cwdtp::client-hello',
          meta: {
            req_key: Buffer.from('hello').toString('base64')
          },
          data: []
        }))
      })
    })

    it('should connect successfully otherwise', done => {
      wsServer.on('connection', ws => {
        const errSpy = jasmine.createSpy('error', _err => {})
        const openSpy = jasmine.createSpy('open', () => {})
        const handshakeTimeoutSpy = jasmine.createSpy('timeout', () => {})
        const conn = new WSConn(null)

        conn.on('open', openSpy)
        conn.on('error', errSpy)
        conn.on('handshakeTimeout', handshakeTimeoutSpy)
        conn.setWs(ws)

        timers.setTimeout(() => {
          expect(conn.id).not.toBeNull()
          expect(conn.state).toBe(WSConnState.OPEN)

          expect(openSpy).toHaveBeenCalled()
          expect(errSpy).not.toHaveBeenCalled()
          expect(handshakeTimeoutSpy).not.toHaveBeenCalled()

          done()
        }, 50)
      })

      const client = new WebSocket('ws://localhost:3820', 'pow.cwdtp')
      client.once('open', () => {
        client.send(JSON.stringify({
          event: 'cwdtp::client-hello',
          meta: {
            req_key: Buffer.from('hello').toString('base64')
          },
          data: []
        }))
      })
      client.once('message', () => {
        client.send(JSON.stringify({
          event: 'cwdtp::server-hello-ack',
          meta: {},
          data: []
        }))
      })
    })
  })

  describe('when connecting to a server,', () => {
    beforeAll(done => {
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(helpers.createTearDown(server, wsServer))
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should time out if server-hello is not received', done => {
      jasmine.clock().install()

      const handshakeTimeoutSpy = jasmine.createSpy('timeout', () => {})
      const conn = new WSConn('ws://localhost:3820')

      expect(conn.state).toBe(WSConnState.OPENING)

      conn.on('handshakeTimeout', handshakeTimeoutSpy)

      timers.setTimeout(() => {
        jasmine.clock().tick(40000)

        expect(conn.id).toBeNull()
        expect(conn.state).toBe(WSConnState.TIMED_OUT)
        expect(handshakeTimeoutSpy).toHaveBeenCalled()

        jasmine.clock().uninstall()

        done()
      }, 100)
    })

    it('should fail if invalid server hello is received', done => {
      wsServer.on('connection', ws => {
        timers.setTimeout(() => {
          ws.send(JSON.stringify({
            eventf: 'cwdtp::server-hello',
            metaf: {},
            dataf: []
          }))
        }, 50)
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const conn = new WSConn('ws://localhost:3820')

      expect(conn.state).toBe(WSConnState.OPENING)

      conn.on('error', errSpy)

      timers.setTimeout(() => {
        expect(conn.id).toBeNull()
        expect(conn.state).toBe(WSConnState.ERROR)
        expect(errSpy).toHaveBeenCalled()

        const err = errSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(errors.HandshakeError)
        expect(err.code).toBe(errors.HandshakeErrorCode.INVALID_CWDTP_MSG)

        done()
      }, 100)
    })

    it('should fail if res_key is not valid', done => {
      wsServer.on('connection', ws => {
        timers.setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'cwdtp::server-hello',
            meta: {
              res_key: 'nope*#!)$%@'
            },
            data: []
          }), { binary: false })
        }, 50)
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const conn = new WSConn('ws://localhost:3820')

      expect(conn.state).toBe(WSConnState.OPENING)

      conn.on('error', errSpy)

      timers.setTimeout(() => {
        expect(conn.id).toBeNull()
        expect(conn.state).toBe(WSConnState.ERROR)
        expect(errSpy).toHaveBeenCalled()

        const err = errSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(errors.HandshakeError)
        expect(err.code).toBe(errors.HandshakeErrorCode.INVALID_RES_KEY)

        done()
      }, 100)
    })

    it('should fail if no connection ID is sent', done => {
      wsServer.on('connection', ws => {
        ws.on('message', async data => {
          const parsed = JSON.parse(data.toString('utf-8'))
          if (parsed.event === 'cwdtp::client-hello') {
            const resKey = Buffer.from(await crypto.hash(
              encoder.encode(parsed.meta.req_key + MagicString),
              crypto.algorithms.sha1
            )).toString('base64')

            ws.send(JSON.stringify({
              event: 'cwdtp::server-hello',
              meta: {
                res_key: resKey
              },
              data: []
            }))
          }
        })
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const conn = new WSConn('ws://localhost:3820')

      expect(conn.state).toBe(WSConnState.OPENING)

      conn.on('error', errSpy)

      timers.setTimeout(() => {
        expect(conn.id).toBeNull()
        expect(conn.state).toBe(WSConnState.ERROR)
        expect(errSpy).toHaveBeenCalled()

        const err = errSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(errors.HandshakeError)
        expect(err.code).toBe(errors.HandshakeErrorCode.MISSING_CONN_ID)

        done()
      }, 100)
    })

    it('should connect successfully if everything passes', done => {
      const connId = 'fjfjfjfdddiie33mccwaa.'
      wsServer.on('connection', ws => {
        ws.on('message', async data => {
          const parsed = JSON.parse(data.toString('utf-8'))
          if (parsed.event === 'cwdtp::client-hello') {
            const resKey = Buffer.from(await crypto.hash(
              encoder.encode(parsed.meta.req_key + MagicString),
              crypto.algorithms.sha1
            )).toString('base64')

            ws.send(JSON.stringify({
              event: 'cwdtp::server-hello',
              meta: {
                res_key: resKey,
                cid: connId
              },
              data: []
            }))
          }
        })
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const openSpy = jasmine.createSpy('open', () => {})
      const conn = new WSConn('ws://localhost:3820')

      expect(conn.state).toBe(WSConnState.OPENING)

      conn.on('error', errSpy)
      conn.on('open', openSpy)

      timers.setTimeout(() => {
        expect(conn.id).toBe(connId)
        expect(conn.state).toBe(WSConnState.OPEN)
        expect(openSpy).toHaveBeenCalled()
        expect(errSpy).not.toHaveBeenCalled()

        conn.disconnect(1001, 'Exiting test item')

        done()
      }, 100)
    })
  })

  describe('when disconnecting,', () => {
    beforeAll(done => {
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(helpers.createTearDown(server, wsServer))
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should successfully disconnect if a close event is received', done => {
      helpers.setUpForSuccess(wsServer)

      wsServer.on('connection', ws => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'cwdtp::close',
            meta: { error: false, reason: 'testing purposes' },
            data: []
          }))
          ws.close(1001)
        }, 50)
      })

      const openSpy = jasmine.createSpy('open', () => {})
      const closeSpy = jasmine.createSpy('close', (_wasError, _reason) => {})
      const closingSpy = jasmine.createSpy('closing', (_code, _reason) => {})
      const closeTimeoutSpy = jasmine.createSpy('closeTimeout', () => {})
      const conn = new WSConn('ws://localhost:3820')

      conn.on('open', openSpy)
      conn.on('close', closeSpy)
      conn.on('closing', closingSpy)
      conn.on('closeTimeout', closeTimeoutSpy)

      setTimeout(() => {
        expect(openSpy).toHaveBeenCalled()
        expect(closingSpy).toHaveBeenCalledOnceWith('testing purposes')
        expect(closeSpy).toHaveBeenCalledOnceWith(false, 'testing purposes')
        expect(closeTimeoutSpy).not.toHaveBeenCalled()

        expect(conn.state).toBe(WSConnState.CLOSED)
        expect(conn._ws.readyState).toBe(WebSocket.CLOSED)

        done()
      }, 100)
    })

    it('should fail if not connected', () => {
      const conn = new WSConn(null)

      expect(() => {
        conn.disconnect(1001, 'testing')
      }).toThrowError(errors.NotConnectedError)
    })

    it('should time out if no acknowledgement is received', done => {
      jasmine.clock().install()

      wsServer.on('connection', ws => {
        ws.on('message', async buf => {
          const parsed = JSON.parse(buf.toString('utf-8'))

          switch (parsed.event) {
            case 'cwdtp::client-hello':
              ws.send(await helpers.handleClientHello(buf.toString('utf-8')))
              break
            case 'cwdtp::server-hello-ack':
              // no-op.
              break
            default:
              // Assume it's a close event.
              // We're going to make it time out.
          }
        })
      })

      const closeSpy = jasmine.createSpy('close', (_wasError, _reason) => {})
      const closingSpy = jasmine.createSpy('closing', _reason => {})
      const closeTimeoutSpy = jasmine.createSpy('closeTimeout', () => {})
      const conn = new WSConn('ws://localhost:3820', {
        pingTimeout: 65535
      })

      conn.on('close', closeSpy)
      conn.on('closing', closingSpy)
      conn.on('closeTimeout', closeTimeoutSpy)
      conn.on('open', () => {
        conn.disconnect(1001, 'Exiting test item')

        expect(conn.state).toBe(WSConnState.CLOSING)
        expect(closingSpy).toHaveBeenCalledOnceWith('Exiting test item')

        jasmine.clock().tick(40000)

        timers.setTimeout(() => {
          expect(closeSpy).toHaveBeenCalledOnceWith(true, 'Close timeout')
          expect(closeTimeoutSpy).toHaveBeenCalled()
          expect(conn.state).toBe(WSConnState.TIMED_OUT)

          expect(conn._ws.readyState).toBe(WebSocket.CLOSED)

          jasmine.clock().uninstall()
          done()
        }, 50)
      })
    })

    it('should successfully close the connection explicitly', done => {
      helpers.setUpForSuccess(wsServer)

      const closeSpy = jasmine.createSpy('close', (_wasError, _reason) => {})
      const closingSpy = jasmine.createSpy('closing', _reason => {})
      const closeTimeoutSpy = jasmine.createSpy('closeTimeout', () => {})
      const conn = new WSConn('ws://localhost:3820')

      conn.on('close', closeSpy)
      conn.on('closing', closingSpy)
      conn.on('closeTimeout', closeTimeoutSpy)
      conn.on('open', () => {
        conn.disconnect(1001, 'Exiting test item')

        expect(conn.state).toBe(WSConnState.CLOSING)
        expect(closingSpy).toHaveBeenCalledOnceWith('Exiting test item')

        timers.setTimeout(() => {
          expect(closeSpy).toHaveBeenCalledOnceWith(false, 'Exiting test item')
          expect(closeTimeoutSpy).not.toHaveBeenCalled()
          expect(conn.state).toBe(WSConnState.CLOSED)

          expect(conn._ws.readyState).toBe(WebSocket.CLOSED)

          done()
        }, 50)
      })
    })
  })
})
