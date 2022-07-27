/* eslint-env jasmine */
/**
 * @fileoverview Specs for testing the WSConn when handling messages.
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
  describe('when sending messages,', () => {
    beforeAll(done => {
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(helpers.createTearDown(server, wsServer))
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should fail when not connected', done => {
      const emitter = helpers.setUpForSuccess(wsServer)
      const conn = new WSConn('ws://localhost:3820')
      emitter.once('messageReceived', () => {
        done.fail('Message got sent.')
      })

      conn.on('open', () => {
        timers.setTimeout(() => {
          conn.disconnect(1001, 'Exiting test item')

          done()
        }, 100)
      })

      expect(() => {
        conn.send('test-event', 'testing', 'testing', { 1: [2, 3] })
      }).toThrowError(errors.NotConnectedError)
    })

    it('should not send messages with empty event names', done => {
      const emitter = helpers.setUpForSuccess(wsServer)
      const conn = new WSConn('ws://localhost:3820')
      emitter.once('messageReceived', () => {
        done.fail('Message got sent.')
      })

      conn.on('open', () => {
        expect(() => {
          conn.send('')
        }).toThrowMatching(e => {
          const isCorrectErrorType = e instanceof errors.InvalidEventName
          const hasCorrectCode = e.code === errors.InvalidEventNameCode.EMPTY_EVENT_NAME

          return isCorrectErrorType && hasCorrectCode
        })

        conn.disconnect(1001, 'Exiting test item')

        done()
      })
    })

    it('should not send messages with non-string event names', done => {
      const emitter = helpers.setUpForSuccess(wsServer)
      const conn = new WSConn('ws://localhost:3820')
      emitter.once('messageReceived', () => {
        done.fail('Message got sent.')
      })

      conn.on('open', () => {
        expect(() => {
          conn.send(Symbol('blue'))
        }).toThrowMatching(TypeError)
        expect(() => {
          conn.send(1000)
        }).toThrowMatching(TypeError)
        expect(() => {
          conn.send(null)
        }).toThrowMatching(TypeError)

        conn.disconnect(1001, 'Exiting test item')

        done()
      })
    })

    it('should not send messages with reserved event names', done => {
      const emitter = helpers.setUpForSuccess(wsServer)
      const conn = new WSConn('ws://localhost:3820')
      emitter.once('messageReceived', () => {
        done.fail('Message got sent.')
      })

      conn.on('open', () => {
        expect(() => {
          conn.send('cwdtp::ping')
        }).toThrowMatching(e => {
          const isCorrectErrorType = e instanceof errors.InvalidEventName
          const hasCorrectCode = e.code === errors.InvalidEventNameCode.RESERVED_EVENT

          return isCorrectErrorType && hasCorrectCode
        })

        conn.disconnect(1001, 'Exiting test item')

        done()
      })
    })

    it('should send messages that comply to CWDTP', done => {
      const emitter = helpers.setUpForSuccess(wsServer)
      const conn = new WSConn('ws://localhost:3820')
      emitter.once('messageReceived', parsed => {
        expect(parsed).toBeInstanceOf(Object)
        expect(parsed).toEqual({
          event: 'test-event',
          meta: {},
          data: [
            'testing', 'testing',
            { 1: [2, 3] }
          ]
        })

        conn.disconnect(1001, 'Exiting test item')

        done()
      })

      conn.on('open', () => {
        conn.send('test-event', 'testing', 'testing', { 1: [2, 3] })
      })
    })

    it('should send binary arrays as specified in CWDTP', done => {
      const emitter = helpers.setUpForSuccess(wsServer)
      const conn = new WSConn('ws://localhost:3820')
      emitter.once('messageReceived', parsed => {
        expect(parsed).toBeInstanceOf(Object)
        expect(parsed).toEqual({
          event: 'test-binary',
          meta: {},
          data: [{
            binary: true,
            type: 'uint8array',
            contents: [100, 3, 154]
          }]
        })

        conn.disconnect(1001, 'Exiting test item')

        done()
      })

      conn.on('open', () => {
        conn.send('test-binary', new Uint8Array([100, 0x3, 154]))
      })
    })
  })

  describe('when receiving messages,', () => {
    beforeAll(done => {
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(helpers.createTearDown(server, wsServer))
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should emit an error if a binary message is received', done => {
      helpers.setUpForSuccess(wsServer)

      wsServer.on('connection', ws => {
        timers.setTimeout(() => {
          ws.send(new Uint8Array(100, 40, 29, 31, 254), { binary: true })
        }, 50)
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const conn = new WSConn('ws://localhost:3820')

      conn.on('error', errSpy)

      timers.setTimeout(() => {
        expect(errSpy).toHaveBeenCalled()

        const err = errSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(errors.InvalidMsgError)
        expect(err.code).toBe(errors.InvalidMsgErrorCode.UNEXPECTED_BINARY)

        expect(conn.state).toBe(WSConnState.ERROR)
        expect(conn._ws.readyState).toBe(WebSocket.OPEN)

        conn.terminate(1001, 'Exiting test item')

        done()
      }, 100)
    })

    it('should emit an error if a non-CWDTP message is received', done => {
      helpers.setUpForSuccess(wsServer)

      wsServer.on('connection', ws => {
        timers.setTimeout(() => {
          ws.send('Hello world!')
        }, 50)
      })

      const errSpy = jasmine.createSpy('error', _err => {})
      const conn = new WSConn('ws://localhost:3820')

      conn.on('error', errSpy)

      timers.setTimeout(() => {
        expect(errSpy).toHaveBeenCalled()

        const err = errSpy.calls.first().args[0]

        expect(err).toBeInstanceOf(errors.InvalidMsgError)
        expect(err.code).toBe(errors.InvalidMsgErrorCode.INVALID_CWDTP)

        expect(conn.state).toBe(WSConnState.ERROR)
        expect(conn._ws.readyState).toBe(WebSocket.OPEN)

        conn.terminate(1001, 'Exiting test item')

        done()
      }, 100)
    })

    it('should not allow listening on empty event names', done => {
      helpers.setUpForSuccess(wsServer)

      const conn = new WSConn('ws://localhost:3820')

      conn.on('open', () => {
        expect(() => {
          conn.messages.on('', () => {})
        }).toThrowMatching(e => {
          const isCorrectErrorType = e instanceof errors.InvalidEventName
          const hasCorrectCode = e.code === errors.InvalidEventNameCode.EMPTY_EVENT_NAME

          return isCorrectErrorType && hasCorrectCode
        })

        conn.disconnect(1001, 'Exiting test item')

        done()
      })
    })

    it('should not allow code to listen on reserved event names', done => {
      helpers.setUpForSuccess(wsServer)

      const conn = new WSConn('ws://localhost:3820')

      conn.on('open', () => {
        expect(() => {
          conn.messages.on('cwdtp::ping', () => {})
        }).toThrowMatching(e => {
          const isCorrectErrorType = e instanceof errors.InvalidEventName
          const hasCorrectCode = e.code === errors.InvalidEventNameCode.RESERVED_EVENT

          return isCorrectErrorType && hasCorrectCode
        })

        conn.disconnect(1001, 'Exiting test item')

        done()
      })
    })

    it('should be able to receive messages that conform to CWDTP', done => {
      helpers.setUpForSuccess(wsServer)
      wsServer.on('connection', ws => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'normal',
            meta: {},
            data: ['hello', ['world']]
          }))
        }, 100)
      })

      const conn = new WSConn('ws://localhost:3820')

      conn.messages.on('normal', (data1, data2) => {
        expect(data1).toBe('hello')
        expect(data2).toBeInstanceOf(Array)
        expect(data2[0]).toBe('world')

        conn.disconnect(1001, 'Exiting test item')

        done()
      })
    })

    it('should be able to receive binary arrays as specified in CWDTP', done => {
      helpers.setUpForSuccess(wsServer)
      wsServer.on('connection', ws => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'bin',
            meta: {},
            data: [{
              binary: true,
              type: 'uint8array',
              contents: [100, 28, 144, 0]
            }]
          }))
        }, 100)
      })

      const conn = new WSConn('ws://localhost:3820')
      conn.messages.on('bin', arr => {
        expect(arr).toBeInstanceOf(Uint8Array)
        expect(arr).toEqual(new Uint8Array([100, 28, 144, 0]))
        done()
      })
    })

    it('should be able to receive DataViews properly', done => {
      helpers.setUpForSuccess(wsServer)
      wsServer.on('connection', ws => {
        const stuff = [
          100, 3200, 4235.2, 54841.2, 458.2, 222
        ]

        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'bin',
            meta: {},
            data: [{
              binary: true,
              type: 'dataview',
              contents: Array.from(
                new Uint8Array(
                  new DataView(
                    new Float64Array(stuff).buffer
                  ).buffer
                )
              )
            }]
          }))
        }, 100)
      })

      const conn = new WSConn('ws://localhost:3820')
      conn.messages.on('bin', view => {
        expect(view).toBeInstanceOf(DataView)
        expect(view.getFloat64(16, true)).toBe(4235.2)
        done()
      })
    })
  })
})
