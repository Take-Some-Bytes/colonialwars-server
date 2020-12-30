/**
 * @fileoverview Mock syslog server.
 */

const net = require('net')

/**
 * Literately just prints everything to the console.
 */
class MockSyslogServer {
  constructor () {
    this.conns = []
    this.dataReceived = false
    this.server = net.createServer(conn => {
      this._onConnect(conn)
    })
  }

  /**
   * Handles a connection to this server.
   * @param {net.Socket} conn The connection to handle.
   */
  _onConnect (conn) {
    console.log('Connection received')
    this.conns.push(conn)
    conn.once('error', err => {
      console.error(err)
      conn.destroy()
    })

    conn.on('data', data => {
      console.log('Received data')
      const stringifiedData = data.toString('utf-8')
      console.log(stringifiedData)
      if (typeof stringifiedData === 'string' && stringifiedData) {
        this.dataReceived = true
      }
    })
  }

  /**
   * Starts this server on port 5514, and host localhost.
   * @returns {Promise<void>}
   */
  start () {
    return new Promise((resolve, reject) => {
      this.server.listen(5514, 'localhost', err => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }

  /**
   * Stops this server.
   * @returns {Promise<void>}
   */
  stop () {
    return new Promise((resolve, reject) => {
      this.conns.forEach(conn => {
        conn.destroy()
      })
      this.server.close(err => {
        if (err) { reject(err) }
        resolve()
      })
    })
  }
}

module.exports = exports = MockSyslogServer
