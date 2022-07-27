/* eslint-env jasmine */
/**
 * @fileoverview Specs for WSConn class when forcefully closing (terminating) the
 * CWDTP connection.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import http from 'http'
import timers from 'timers'

import WebSocket, { WebSocketServer } from 'ws'

import * as helpers from '../helpers/cwdtp-helpers.js'

import * as errors from '../../lib/cwdtp/errors.js'
import WSConn, { WSConnState } from '../../lib/cwdtp/conn.js'

const server = http.createServer((_, res) => {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/plain')
  res.end('Not Found.')
})
const wsServer = new WebSocketServer({
  server,
  handleProtocols: () => {
    return 'pow.cwdtp'
  }
})

describe('The WSConn class,', () => {
  describe('when terminating,', () => {
    beforeAll(done => {
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(helpers.createTearDown(server, wsServer))
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should fail if WebSocket is not connected', () => {
      const conn = new WSConn(null)

      expect(() => {
        conn.terminate(1000, '')
      }).toThrowError(errors.NotConnectedError)
    })

    it('should not fail if WSConn is not connected', done => {
      const conn = new WSConn('ws://localhost:3820')

      wsServer.on('connection', () => {
        // Trick here is to find a time where the WebSocket is connected
        // but the CWDTP connection has not.
        timers.setTimeout(() => {
          expect(conn._ws).toBeInstanceOf(WebSocket)

          expect(() => {
            conn.terminate(1000, '')
          }).not.toThrowError(errors.NotConnectedError)

          expect(conn.id).toBeNull()
          expect(conn.state).toBe(WSConnState.CLOSED)

          done()
        }, 10)
      })
    })

    it('should immediately start closing the underlying WebSocket', done => {
      helpers.setUpForSuccess(wsServer)

      const conn = new WSConn('ws://localhost:3820')

      conn.on('open', () => {
        expect(() => {
          conn.terminate(1000, '')
        }).not.toThrowError(errors.NotConnectedError)

        expect(conn.id).not.toBeNull()
        expect(conn.state).toBe(WSConnState.CLOSED)
        expect(conn._ws.readyState).toBe(WebSocket.CLOSING)

        done()
      })
    })
  })

  describe('when handling a forceful closure,', () => {
    beforeAll(done => {
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(helpers.createTearDown(server, wsServer))
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should emit an error if the closure happens before the handshake completes', done => {
      wsServer.on('connection', ws => {
        ws.close(1000, 'Die')
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const openSpy = jasmine.createSpy('open', () => {})
      const conn = new WSConn('ws://localhost:3820')

      conn.on('open', openSpy)
      conn.on('error', errSpy)

      timers.setTimeout(() => {
        expect(errSpy).toHaveBeenCalled()
        expect(openSpy).not.toHaveBeenCalled()

        expect(conn.state).toBe(WSConnState.ERROR)
        expect(conn._ws.readyState).toBe(WebSocket.CLOSED)

        const err = errSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(errors.ConnectionReset)

        done()
      }, 10)
    })

    it('should close without error if handshake has completed', done => {
      helpers.setUpForSuccess(wsServer)
      wsServer.on('connection', ws => {
        timers.setTimeout(() => {
          ws.close(1000, 'Die')
        }, 50)
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const openSpy = jasmine.createSpy('open', () => {})
      const closeSpy = jasmine.createSpy('close', _wasError => {})
      const conn = new WSConn('ws://localhost:3820')

      conn.on('open', openSpy)
      conn.on('error', errSpy)
      conn.on('close', closeSpy)

      timers.setTimeout(() => {
        expect(errSpy).not.toHaveBeenCalled()
        expect(openSpy).toHaveBeenCalled()
        expect(closeSpy).toHaveBeenCalledOnceWith(true, 'Die')

        expect(conn.state).toBe(WSConnState.CLOSED)
        expect(conn._ws.readyState).toBe(WebSocket.CLOSED)

        done()
      }, 100)
    })
  })
})
