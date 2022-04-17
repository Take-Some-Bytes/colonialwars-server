/* eslint-env jasmine */
/**
 * @fileoverview Tests for the CWServer class.
 */

const http = require('http')

const CWServer = require('../')

const fetch = require('./helpers/fetch')
const getPrivateIp = require('./helpers/get-private-ip')

describe('The CWServer class,', () => {
  describe('when initialized,', () => {
    let cwServer = null

    it('should construct and initialize without error', async () => {
      let err = null
      try {
        cwServer = await CWServer.create()
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(cwServer).toBeInstanceOf(CWServer)
    })

    it('should be able to start and stop', async () => {
      // First trying start it.
      if (cwServer instanceof CWServer) {
        await cwServer.start()
      }

      const serverRes = await fetch('http://localhost:4000/status-report')
      expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
      expect(serverRes.meta.statusCode).toBe(200)
      expect(serverRes.body).toBeInstanceOf(Buffer)
      expect(JSON.parse(serverRes.body.toString('utf-8')).data.serverRunning)
        .toBeTrue()

      // Now try stopping it.
      let err = null

      if (cwServer instanceof CWServer) {
        await cwServer.stop()
      }

      try {
        await fetch('http://localhost:4000/status-report')
      } catch (ex) {
        err = ex
      }

      expect(err).toBeInstanceOf(Error)
      expect(err.code).toBe('ECONNREFUSED')
      expect(err.syscall).toBe('connect')
    })
  })

  describe('when not initialized,', () => {
    it('should throw an error when trying to start', async () => {
      const cwServer = new CWServer()
      let err = null

      try {
        await cwServer.start()
      } catch (e) {
        err = e
      }

      expect(err).not.toBeNull()
    })

    it('should throw an error when trying to stop', async () => {
      const cwServer = new CWServer()
      let err = null

      try {
        await cwServer.stop()
      } catch (e) {
        err = e
      }

      expect(err).not.toBeNull()
    })
  })

  it('should be able to start at the specified port', async () => {
    process.env.PORT = 4444

    const cwServer = await CWServer.create()
    await cwServer.start()

    const serverRes = await fetch('http://localhost:4444/status-report')
    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(200)
    expect(serverRes.body).toBeInstanceOf(Buffer)
    expect(JSON.parse(serverRes.body.toString('utf-8')).data.serverRunning)
      .toBeTrue()

    await cwServer.stop()
  })

  it('should be able to start at the specified host', async () => {
    const privateIp = getPrivateIp()
    process.env.HOST = privateIp

    const cwServer = await CWServer.create()
    await cwServer.start()

    const serverRes = await fetch(`http://${privateIp}:4444/status-report`)
    expect(serverRes.meta).toBeInstanceOf(http.IncomingMessage)
    expect(serverRes.meta.statusCode).toBe(200)
    expect(serverRes.body).toBeInstanceOf(Buffer)
    expect(JSON.parse(serverRes.body.toString('utf-8')).data.serverRunning)
      .toBeTrue()

    await cwServer.stop()
  })
})
