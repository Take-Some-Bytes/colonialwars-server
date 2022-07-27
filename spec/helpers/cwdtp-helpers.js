/* eslint-env node */
/**
 * @fileoverview Helpers for conducting CWDTP specs.
 */

import events from 'events'

import { WebSocketServer } from 'ws'

import { MagicString } from 'colonialwars-lib/cwdtp-engine'

import * as crypto from '../../lib/cwdtp/crypto.js'

const encoder = new TextEncoder()

/**
 * Handles a client-hello message.
 *
 * Returns a server-hello message.
 * @param {string} msg The client-hello message.
 */
export async function handleClientHello (msg) {
  const parsed = JSON.parse(msg)
  const connid = Buffer.from(await crypto.randomBytes(16)).toString('hex')
  const resKey = Buffer.from(await crypto.hash(
    encoder.encode(parsed.meta.req_key + MagicString),
    crypto.algorithms.sha1
  )).toString('base64')

  return JSON.stringify({
    event: 'cwdtp::server-hello',
    meta: {
      res_key: resKey,
      cid: connid
    },
    data: []
  })
}
/**
 * Sets up a WebSocket Server for an "everything should work" spec.
 * @param {import('ws').Server} wsServer The server to set up.
 */
export function setUpForSuccess (wsServer) {
  const emitter = new events.EventEmitter()
  wsServer.on('connection', ws => {
    ws.on('message', async data => {
      const parsed = JSON.parse(data.toString('utf-8'))

      switch (parsed.event) {
        case 'cwdtp::client-hello': {
          ws.send(await handleClientHello(data.toString('utf-8')))
          break
        }
        case 'cwdtp::close': {
          // Close the connection.
          ws.send(JSON.stringify({
            event: 'cwdtp::close-ack',
            meta: {},
            data: []
          }))
          break
        }
        // No-op.
        case 'cwdtp::server-hello-ack': break
        default:
          emitter.emit('messageReceived', parsed)
      }
    })
  })

  return emitter
}

/**
 * Creates a function that cleans up a Websocket and HTTP server after a suite
 * completes.
 * @param {import('http').Server} httpServer The HTTP server to tear down.
 * @param {import('ws').Server} wsServer The WebSocket server to tear down.
 * @returns {(done: DoneFn) => void}
 */
export function createTearDown (httpServer, wsServer) {
  return done => {
    if (wsServer instanceof WebSocketServer) {
      wsServer.clients.forEach(ws => {
        ws.terminate()
      })
    }
    httpServer.removeAllListeners('error')
    httpServer.close(err => {
      if (err) return done.fail(err)

      done()
    })
  }
}
