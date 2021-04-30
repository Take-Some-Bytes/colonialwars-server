/* eslint-env jasmine */
/**
 * @fileoverview Specs for the ``WSConn`` class, which implements the client
 * socket for CWDTP.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const http = require('http')
const EventEmitter = require('events')
const bufferUtils = require('../lib/cwdtp/buffer-utils')
const crypto = require('../lib/cwdtp/crypto')

const WebSocket = require('ws')
const WSConn = require('../lib/cwdtp/conn')

const server = http.createServer((_, res) => {
  res.statusCode = 404
  res.setHeader('Content-Type', 'text/plain')
  res.end('Not Found.')
})
const noop = () => { /* no-op */ }
/**
 * @type {WebSocket.Server}
 */
let wsServer = null

/**
 * Sets up a WebSocket Server.
 */
function setUp () {
  const emitter = new EventEmitter()
  wsServer.on('connection', ws => {
    ws.on('message', async data => {
      const parsed = JSON.parse(data.toString('utf16le'))
      const connid = Buffer.from(await crypto.randomBytes(16)).toString('hex')
      if (parsed.event === 'cwdtp::client-hello') {
        const resKey = bufferUtils.toBase64(await crypto.hash(
          bufferUtils.toBinary(parsed.meta.req_key + 'FJcod23c-aodDJf-302-D38cadjeC2381-F8fad-AJD3', false),
          'SHA-1'
        ))

        ws.send(JSON.stringify({
          event: 'cwdtp::server-hello',
          meta: {
            res_key: resKey,
            cid: connid
          },
          data: []
        }))
      } else {
        emitter.emit('messageReceived', parsed)
      }
    })
  })

  return emitter
}
/**
 * Some teardown to run after every suite.
 * @param {DoneFn} done Done callback.
 */
function tearDown (done) {
  if (wsServer instanceof WebSocket.Server) {
    wsServer.clients.forEach(ws => {
      ws.terminate()
    })
  }
  server.removeAllListeners('upgrade')
  server.removeAllListeners('error')
  server.close(err => {
    if (err) return done.fail(err)
    wsServer = null
    done()
  })
}

describe('The WSConn class,', () => {
  it('should create an internal WebSocket when in client mode', () => {
    const conn = new WSConn('http://localhost')
    conn.on('error', noop)

    expect(conn.isClient).toBe(true)
    expect(conn.ws).toBeInstanceOf(WebSocket)
  })

  it('should not create any WebSocket instances when in server mode', () => {
    const conn = new WSConn(null)

    expect(conn.ws).toBe(null)
    expect(conn.isClient).toBe(false)
  })

  describe('when connecting to a server,', () => {
    beforeAll(done => {
      wsServer = new WebSocket.Server({
        server: server,
        handleProtocols: () => {
          return 'pow.cwdtp'
        }
      })
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(tearDown)
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should abort the handshake if no reply is received after 30s', done => {
      const realSetTimeout = setTimeout
      let err = null
      jasmine.clock().install()
      const conn = new WSConn('http://localhost:3820')
      conn.on('error', ex => (err = ex))

      realSetTimeout(() => {
        jasmine.clock().tick(31000)

        expect(err).toBeInstanceOf(Error)
        expect(err.code).toBe('EHSTIMEOUT')
        expect(conn.abortedHandshake).toBe(true)
        jasmine.clock().uninstall()
        done()
      }, 500)
    })

    it('should abort the handshake if invalid server hello is received', done => {
      let abortHandshakeEmitted = false
      let reason = ''
      wsServer.on('connection', ws => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'cwdtp::server-hello',
            meta: {},
            valid: false,
            data: []
          }))
        }, 40)
      })
      const conn = new WSConn('http://localhost:3820')
      conn.on('abortingHandshake', why => {
        abortHandshakeEmitted = true
        reason = why
      })

      setTimeout(() => {
        expect(abortHandshakeEmitted).toBe(true)
        expect(conn.abortedHandshake).toBe(true)
        expect(reason).toBe('Invalid server handshake response!')
        done()
      }, 500)
    })

    it('should abort the handshake if res_key does not match', done => {
      let abortHandshakeEmitted = false
      let reason = ''
      wsServer.on('connection', ws => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'cwdtp::server-hello',
            meta: {
              res_key: 'nope'
            },
            valid: false,
            data: []
          }))
        }, 40)
      })
      const conn = new WSConn('http://localhost:3820')
      conn.on('abortingHandshake', why => {
        abortHandshakeEmitted = true
        reason = why
      })

      setTimeout(() => {
        expect(abortHandshakeEmitted).toBe(true)
        expect(conn.abortedHandshake).toBe(true)
        expect(reason).toBe('Invalid response key!')
        done()
      }, 500)
    })

    it('should abort the handshake if no connection ID is sent', done => {
      let abortHandshakeEmitted = false
      let reason = ''
      wsServer.on('connection', ws => {
        ws.on('message', async data => {
          const parsed = JSON.parse(data.toString('utf16le'))
          if (parsed.event === 'cwdtp::client-hello') {
            const resKey = bufferUtils.toBase64(await crypto.hash(
              bufferUtils.toBinary(parsed.meta.req_key + 'FJcod23c-aodDJf-302-D38cadjeC2381-F8fad-AJD3', false),
              'SHA-1'
            ))

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
      const conn = new WSConn('http://localhost:3820')
      conn.on('abortingHandshake', why => {
        abortHandshakeEmitted = true
        reason = why
      })

      setTimeout(() => {
        expect(abortHandshakeEmitted).toBe(true)
        expect(conn.abortedHandshake).toBe(true)
        expect(reason).toBe('No connection ID received!')
        done()
      }, 500)
    })

    it('should connect successfully if everything passes', done => {
      const connid = 'fjfjfjfdddiie33mccwaa.'
      let abortHandshakeEmitted = false
      let connected = false
      let reason = ''
      wsServer.on('connection', ws => {
        ws.on('message', async data => {
          const parsed = JSON.parse(data.toString('utf16le'))
          if (parsed.event === 'cwdtp::client-hello') {
            const resKey = bufferUtils.toBase64(await crypto.hash(
              bufferUtils.toBinary(parsed.meta.req_key + 'FJcod23c-aodDJf-302-D38cadjeC2381-F8fad-AJD3', false),
              'SHA-1'
            ))

            ws.send(JSON.stringify({
              event: 'cwdtp::server-hello',
              meta: {
                res_key: resKey,
                cid: connid
              },
              data: []
            }))
          }
        })
      })
      const conn = new WSConn('http://localhost:3820')
      conn.on('abortingHandshake', why => {
        abortHandshakeEmitted = true
        reason = why
      })
      conn.on('connect', () => (connected = true))

      setTimeout(() => {
        expect(abortHandshakeEmitted).toBe(false)
        expect(conn.abortedHandshake).toBe(false)
        expect(conn.connected).toBe(true)
        expect(connected).toBe(true)
        expect(conn.id).toBe(connid)
        expect(reason).toBe('')
        conn.disconnect(false, 1001, 'Exiting test item', false)
        done()
      }, 500)
    })
  })

  describe('when sending messages,', () => {
    beforeAll(done => {
      wsServer = new WebSocket.Server({
        server: server,
        handleProtocols: () => {
          return 'pow.cwdtp'
        }
      })
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(tearDown)
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should not send messages when not connected', done => {
      const emitter = setUp(wsServer)
      const conn = new WSConn('http://localhost:3820')
      emitter.once('messageReceived', () => {
        done.fail('Message got sent.')
      })
      try {
        conn.emit('test-event', 'testing', 'testing', { 1: [2, 3] })
      } catch (ex) {
        expect(ex).toBeInstanceOf(Error)
        expect(ex.message).toBe('WSConn is not connected!')
        done()
      }
    })

    it('should send messages that comply to CWDTP message structures', done => {
      const emitter = setUp(wsServer)
      const conn = new WSConn('http://localhost:3820')
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
        conn.disconnect(false, 1001, 'Exiting test item', false)
        done()
      })

      conn.on('connect', () => {
        conn.emit('test-event', 'testing', 'testing', { 1: [2, 3] })
      })
    })

    it('should send binary arrays as specified in CWDTP', done => {
      const emitter = setUp(wsServer)
      const conn = new WSConn('http://localhost:3820')
      emitter.once('messageReceived', parsed => {
        expect(parsed).toBeInstanceOf(Object)
        expect(parsed).toEqual({
          event: 'test-binary',
          meta: {},
          data: [{
            binary: true,
            type: 'int8array',
            contents: [100, 3, 154]
          }]
        })
        conn.disconnect(false, 1001, 'Exiting test item', false)
        done()
      })

      conn.on('connect', () => {
        conn.emit('test-binary', new Int8Array([100, 0x3, -102]))
      })
    })
  })

  describe('when receiving messages,', () => {
    beforeAll(done => {
      wsServer = new WebSocket.Server({
        server: server,
        handleProtocols: () => {
          return 'pow.cwdtp'
        }
      })
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(tearDown)
    afterEach(() => {
      wsServer.removeAllListeners()
    })

    it('should be able to receive binary arrays as specified in CWDTP', done => {
      setUp(wsServer)
      wsServer.on('connection', ws => {
        setTimeout(() => {
          ws.send(JSON.stringify({
            event: 'bin',
            meta: {},
            data: [{
              binary: true,
              type: 'float32array',
              contents: [100.5, 20.1, 3.2, -100.4]
            }]
          }))
        })
      }, 700)

      const conn = new WSConn('http://localhost:3820')
      conn.on('bin', arr => {
        expect(arr).toBeInstanceOf(Float32Array)
        expect(arr).toEqual(new Float32Array([100.5, 20.1, 3.2, -100.4]))
        done()
      })
    })

    it('should be able to receive DataViews properly', done => {
      setUp(wsServer)
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
              contents: Array.from(new Uint8Array(new DataView(new Float64Array(stuff).buffer).buffer))
            }]
          }))
        })
      }, 700)

      const conn = new WSConn('http://localhost:3820')
      conn.on('bin', view => {
        expect(view).toBeInstanceOf(DataView)
        expect(view.getFloat64(16, true)).toBe(4235.2)
        done()
      })
    })
  })
})
