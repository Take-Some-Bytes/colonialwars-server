/**
 * @fileoverview Promisified `http.request`.
 */

import http from 'http'

/**
 * @typedef {Object} HTTPResponse
 * @prop {http.IncomingMessage} meta
 * @prop {Buffer|null} body
 */

/**
 * Basic `http.request` promisified version.
 * @param {string|URL|http.RequestOptions} opts Request options.
 * @param {string|Buffer} body Request body.
 * @returns {Promise<HTTPResponse>}
 */
export default function fetch (opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      const chunks = []
      res.on('data', data => {
        chunks.push(data)
      })
      res.on('error', err => {
        reject(err)
      })
      res.on('end', () => {
        const resBody =
          chunks.length > 0
            ? Buffer.concat(chunks)
            : null
        resolve({
          meta: res,
          body: resBody
        })
      })
    })
    req.on('error', reject)

    if (opts && typeof opts === 'object' && opts.method === 'POST') {
      req.write(body)
    }
    req.end()
  })
}
