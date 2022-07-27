/* eslint-env jasmine */
/**
 * @fileoverview Specs for WSConn class when idling.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import http from 'http'
import timers from 'timers'

import WebSocket, { WebSocketServer } from 'ws'

import * as helpers from '../helpers/cwdtp-helpers.js'

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

describe('The WSConn class, when handling an idle connection,', () => {
  beforeAll(done => {
    server.listen(3820, 'localhost', done)
    server.on('error', done.fail)
  })
  afterAll(helpers.createTearDown(server, wsServer))
  afterEach(() => {
    wsServer.removeAllListeners()
  })

  it('should terminate the connection if no ping is received in the alloted time', done => {
    // The following function doesn't have a heartbeat mechanism.
    helpers.setUpForSuccess(wsServer)

    const pingTimeoutSpy = jasmine.createSpy('pingTimeout', () => {})
    const conn = new WSConn('ws://localhost:3820', {
      pingTimeout: 1000
    })

    conn.on('pingTimeout', pingTimeoutSpy)

    jasmine.clock().install()

    timers.setTimeout(() => {
      expect(conn.state).toBe(WSConnState.OPEN)
      expect(conn.isAlive).toBeTrue()
      expect(pingTimeoutSpy).not.toHaveBeenCalled()

      jasmine.clock().tick(1100)
      jasmine.clock().uninstall()

      timers.setImmediate(() => {
        expect(conn.isAlive).toBeFalse()
        expect(conn.state).toBe(WSConnState.CLOSED)
        expect(pingTimeoutSpy).toHaveBeenCalled()
        expect(conn._ws.readyState).toBe(WebSocket.CLOSING)

        done()
      })
    }, 50)
  })

  it('should not terminate the connection if a ping is received', done => {
    // The following function doesn't have a heartbeat mechanism.
    helpers.setUpForSuccess(wsServer)
    wsServer.on('connection', ws => {
      setTimeout(() => {
        ws.send(JSON.stringify({
          event: 'cwdtp::ping',
          meta: {},
          data: []
        }))
      }, 500)
    })

    const pingTimeoutSpy = jasmine.createSpy('pingTimeout', () => {})
    const conn = new WSConn('ws://localhost:3820', {
      pingTimeout: 1000
    })

    conn.on('error', console.log.bind(console))
    conn.on('pingTimeout', pingTimeoutSpy)

    jasmine.clock().install()

    timers.setTimeout(() => {
      expect(conn.state).toBe(WSConnState.OPEN)
      expect(conn.isAlive).toBeTrue()
      expect(pingTimeoutSpy).not.toHaveBeenCalled()

      jasmine.clock().tick(500)

      timers.setTimeout(() => {
        jasmine.clock().tick(600)
        jasmine.clock().uninstall()

        expect(conn.isAlive).toBeTrue()
        expect(conn.state).toBe(WSConnState.OPEN)
        expect(pingTimeoutSpy).not.toHaveBeenCalled()
        expect(conn._ws.readyState).toBe(WebSocket.OPEN)

        done()
      }, 10)
    }, 50)
  })
})
