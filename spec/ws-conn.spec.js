/* eslint-env jasmine */
/**
 * @fileoverview Specs for the ``WSConn`` class, which wraps
 * a plain WebSocket instance.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const os = require('os')
const http = require('http')
const events = require('events')

const WebSocket = require('ws')
const WSConn = require('../lib/websockets/conn')

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
/**
 * @type {string}
 */
const localIP = Object.values(results)[0][0]

/**
 * Creates a WebSocket connection
 * @param {string} [url]
 * @param {Partial<WebSocket.ClientOptions&import('http').ClientRequestArgs>} [opts]
 */
function createConnection (url, opts) {
  return new WebSocket(
    url || 'http://localhost:3820/?hi=hello', Object.assign({
      origin: 'http://localhost:4000',
      localAddress: '127.0.0.1'
    }, opts)
  )
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
  it('should wrap a normal WebSocket instance', () => {
    const ws = createConnection()
    ws.on('error', err => {
      console.error(err.message)
    })
    const conn = new WSConn(ws, { isClient: true })

    expect(conn.ws).toBeInstanceOf(WebSocket)
  })

  describe('when handling reconnects,', () => {
    const connAttempts = new Map([
      ['127.0.0.1', 0],
      [localIP, 0]
    ])
    beforeAll(done => {
      server.on('upgrade', (req, socket, head) => {
        // No connection for you.
        socket.write([
          'HTTP/1.1 404 NOPE',
          '\r\n'
        ].join('\r\n'))
        connAttempts.set(socket.remoteAddress, connAttempts.get(socket.remoteAddress) + 1)
        socket.destroy()
      })
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(tearDown)
    afterEach(() => {
      Array.from(connAttempts.keys()).forEach(key => {
        connAttempts.set(key, 0)
      })
    })

    it('should not try to reconnect when reconnect option is false', done => {
      const ws = createConnection(null, { localAddress: localIP })
      const conn = new WSConn(ws, {
        isClient: true,
        reconnect: false
      })
      ws.on('error', noop)
      conn.on('error', noop)

      setTimeout(() => {
        expect(conn.connected).toBe(false)
        expect(connAttempts.get(localIP)).toBe(1)
        done()
      }, 500)
    })

    it('should try to reconnect when reconnect option is true', done => {
      const ws = createConnection()
      const conn = new WSConn(ws, {
        isClient: true,
        reconnect: true,
        reconnectionLimit: 2
      })
      ws.on('error', noop)
      conn.on('error', noop)

      setTimeout(() => {
        expect(conn.reconnects).toBe(2)
        expect(conn.connected).toBe(false)
        expect(connAttempts.get('127.0.0.1')).toBe(2)
        done()
      }, 3000)
    })
  })

  describe('when sending messages,', () => {
    beforeAll(done => {
      wsServer = new WebSocket.Server({
        server: server
      })
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(tearDown)
    afterEach(() => {
      wsServer.removeAllListeners('connection')
    })

    it('should send binary encoded JSON', done => {
      const emitter = new events.EventEmitter()
      emitter.on('messageReceived', data => {
        let err = null
        try {
          JSON.parse(data.toString('utf16le'))
        } catch (ex) {
          err = ex
        }
        expect(data).toBeInstanceOf(Buffer)
        expect(err).toBe(null)
        conn.disconnect(false, 1001, 'Exiting test suite item.')
        setTimeout(() => {
          done()
        }, 100)
      })

      wsServer.on('connection', ws => {
        ws.on('message', data => {
          emitter.emit('messageReceived', data)
        })
      })

      const conn = new WSConn(createConnection(), {
        isClient: true
      })
      conn.on('connect', () => {
        conn.emit('hi', 'greeatings')
      })
    })

    it('should send JSON with a specified structure', done => {
      const emitter = new events.EventEmitter()
      emitter.on('messageReceived', data => {
        let parsed = null
        let err = null
        try {
          parsed = JSON.parse(data.toString('utf16le'))
        } catch (ex) {
          err = ex
        }
        expect(parsed).toBeInstanceOf(Object)
        expect(parsed).toEqual({
          event: 'user_message',
          data: [{
            contents: 'Greetings from Goodness Me!'
          }]
        })
        expect(data).toBeInstanceOf(Buffer)
        expect(err).toBe(null)
        conn.disconnect(false, 1001, 'Exiting test suite item.')
        setTimeout(() => {
          done()
        }, 100)
      })

      wsServer.on('connection', ws => {
        ws.on('message', data => {
          emitter.emit('messageReceived', data)
        })
      })

      const conn = new WSConn(createConnection(), {
        isClient: true
      })
      conn.on('connect', () => {
        conn.emit('user_message', { contents: 'Greetings from Goodness Me!' })
      })
    })

    it('should be able to send binary arrays properly', done => {
      const emitter = new events.EventEmitter()
      emitter.on('messageReceived', data => {
        let parsed = null
        let err = null
        try {
          parsed = JSON.parse(data.toString('utf16le'))
        } catch (ex) {
          err = ex
        }
        expect(parsed).toBeInstanceOf(Object)
        expect(parsed).toEqual({
          event: 'binary',
          data: [{
            type: 'arraybuffer',
            binary: true,
            as: 'uint8array',
            content: [100, 100, 100, 100, 100, 100, 100, 100]
          }]
        })
        expect(data).toBeInstanceOf(Buffer)
        expect(err).toBe(null)
        conn.disconnect(false, 1001, 'Exiting test suite item.')
        setTimeout(() => {
          done()
        }, 100)
      })

      wsServer.on('connection', ws => {
        ws.on('message', data => {
          emitter.emit('messageReceived', data)
        })
      })

      const conn = new WSConn(createConnection(), {
        isClient: true
      })
      conn.on('connect', () => {
        conn.emit('binary', new Uint8Array([100, 100, 100, 100, 100, 100, 100, 100]).buffer)
      })
    })
  })

  describe('when receiving messages,', () => {
    beforeAll(done => {
      wsServer = new WebSocket.Server({
        server: server
      })
      server.listen(3820, 'localhost', done)
      server.on('error', done.fail)
    })
    afterAll(tearDown)
    afterEach(() => {
      wsServer.removeAllListeners('connection')
    })

    it('should allow plain text frames that have proper JSON in them', done => {
      wsServer.on('connection', ws => {
        ws.send(JSON.stringify({
          event: 'server-hello',
          data: ['Hello from the server!']
        }))
      })

      const conn = new WSConn(createConnection(), { isClient: true })
      conn.on('server-hello', data => {
        expect(data).toBe('Hello from the server!')
        conn.disconnect(false, 1001, 'Exiting test suite item.')
        setTimeout(() => {
          done()
        }, 100)
      })
    })

    it('should allow UTF-16 encoded binary frames that also have proper JSON', done => {
      wsServer.on('connection', ws => {
        ws.send(Buffer.from(JSON.stringify({
          event: 'server-hello',
          data: ['Hello from the server!']
        })))
      })

      const conn = new WSConn(createConnection(), { isClient: true })
      conn.on('server-hello', data => {
        expect(data).toBe('Hello from the server!')
        conn.disconnect(false, 1001, 'Exiting test suite item.')
        setTimeout(() => {
          done()
        }, 100)
      })
    })
  })
})
