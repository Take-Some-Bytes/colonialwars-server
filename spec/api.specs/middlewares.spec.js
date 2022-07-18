/* eslint-env jasmine */
/**
 * @fileoverview Tests for Middlewares class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

import fs from 'fs'

import Middlewares from '../../lib/controllers/middlewares.js'

import MockLoggers from '../mocks/internal/mock-loggers.js'
import MockHttpRequest from '../mocks/external/mock-http-request.js'
import MockHttpResponse from '../mocks/external/mock-http-response.js'

describe('The Middlewares class,', () => {
  const nullWriteStream = fs.createWriteStream('/dev/null', { encoding: 'utf8' })
  let middlewares = null

  it('should construct without error', () => {
    expect(() => {
      middlewares = new Middlewares({
        URL_MAX_LEN: 100,
        loggers: new MockLoggers(),
        corsOpts: { origin: 'http://localhost:3000' },
        requestLoggerStream: nullWriteStream
      })
    }).not.toThrow()
  })

  it('should be able to set a simple CSP header', () => {
    const mockRes = new MockHttpResponse()
    let calledNext = false

    middlewares.setCSPHeader()(null, mockRes, () => {
      calledNext = true
    })

    expect(calledNext).toBeTrue()
    expect(mockRes.headers['Content-Security-Policy']).toEqual("default-src 'none'")
  })

  it('should be able to parse querystring', () => {
    const mockReq = new MockHttpRequest({ url: '/?i_am_a_qs=1&can_i_have_cheese=0' })
    let calledNext = false

    middlewares.queryParser()(mockReq, null, err => {
      if (err) { throw err }

      calledNext = true
    })

    expect(calledNext).toBe(true)
    expect(mockReq.query).toBeInstanceOf(URLSearchParams)
    expect(mockReq.query.get('i_am_a_qs')).toBe('1')
    expect(mockReq.query.get('can_i_have_cheese')).toBe('0')
  })

  it('should be able to parse Forwarded header', () => {
    const mockReq = new MockHttpRequest({
      headers: {
        forwarded: 'for=198.51.100.17;by=203.0.113.60;proto=http;host=example.com'
      }
    })
    let calledNext = false

    middlewares.forwardedParser()(mockReq, null, err => {
      if (err) { throw err }

      calledNext = true
    })

    expect(calledNext).toBe(true)
    expect(mockReq.forwardedRecords).toBeInstanceOf(Array)
    expect(mockReq.forwardedRecords.length).toBe(1)
  })

  it('should be able to give each request a unique ID', () => {
    const reqs = [new MockHttpRequest({ }), new MockHttpRequest({ })]
    const idFunc = middlewares.requestID()
    let passes = 0

    for (const req of reqs) {
      idFunc(req, null, () => { passes++ })
    }

    expect(passes).toBe(2)
    expect(reqs[0].id).toBeInstanceOf(String)
    expect(reqs[1].id).toBeInstanceOf(String)
    expect(reqs[0].id).not.toBe(reqs[1].id)
  })
})

describe('The checkpoint middlewares,', () => {
  const middlewares = new Middlewares({
    URL_MAX_LEN: 100,
    loggers: new MockLoggers(),
    corsOpts: { origin: 'http://localhost:3000' },
    requestLoggerStream: { write: process.stdout.write.bind(process.stdout) }
  })

  describe('the system checkpoint,', () => {
    it('should not let request pass if URL is too long', () => {
      const mockReq = new MockHttpRequest({
        url: [
          '/thisurlmustbeveryveryveryveryveryveryveryveryverylongorthis',
          'requestwillpassandwewantittonotpass?iamright=1&thiswillpass=0',
          '&pleaseletthisnotpass=pleasepleaseplease'
        ].join(''),
        ip: '123.45.67.89',
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()
      let calledNext = false

      middlewares.sysCheckpoint(
        ['GET', 'HEAD']
      )(mockReq, mockRes, err => {
        if (err) throw err

        calledNext = true
      })

      expect(calledNext).toBe(false)
      expect(mockRes.statusCode).toBe(414)
      expect(mockRes.responseContent).toBeInstanceOf(Buffer)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'URL too long.' }
      })
    })

    it('should not let request pass if HTTP method is not implemented', () => {
      const mockReq = new MockHttpRequest({
        url: '/i-am-not-too-long.html',
        ip: '111.222.33.44',
        method: 'POST'
      })
      const mockRes = new MockHttpResponse()
      let calledNext = false

      middlewares.sysCheckpoint(
        ['GET', 'HEAD']
      )(mockReq, mockRes, err => {
        if (err) throw err

        calledNext = true
      })

      expect(calledNext).toBe(false)
      expect(mockRes.statusCode).toBe(501)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'POST is not implemented.' }
      })
    })

    it('should let valid request pass', () => {
      const mockReq = new MockHttpRequest({
        url: '/index.valid.html',
        ip: '98.76.54.32',
        method: 'GET'
      })
      const mockRes = new MockHttpResponse()
      let calledNext = false

      middlewares.sysCheckpoint(
        ['GET', 'HEAD']
      )(mockReq, mockRes, err => {
        if (err) throw err

        calledNext = true
      })

      expect(calledNext).toBe(true)
      expect(mockRes.statusCode).toBe(200)
      expect(mockRes.responseContent).toBe(null)
    })
  })

  describe('the accept checkpoint,', () => {
    it('should not let request pass on accept mismatch', () => {
      const mockReq = new MockHttpRequest({
        headers: {
          accept: 'text/html'
        },
        ip: '32.104.212.0'
      })
      const mockRes = new MockHttpResponse()
      let calledNext = false

      middlewares.acceptCheckpoint()(mockReq, mockRes, err => {
        if (err) throw err

        calledNext = true
      })

      expect(calledNext).toBe(false)
      expect(mockRes.statusCode).toBe(406)
      expect(JSON.parse(mockRes.responseContent.toString('utf-8'))).toEqual({
        status: 'error',
        error: { message: 'Content negotiation failed.' }
      })
    })

    it('should let valid requests pass', () => {
      const mockReqs = [
        new MockHttpRequest({ headers: { accept: '*/*' }, ip: '23.110.32.0' }),
        new MockHttpRequest({ headers: { accept: 'text/html, */*' }, ip: '49.103.0.223' })
      ]
      // This doesn't look like correct grammar.
      const mockReses = [
        new MockHttpResponse(),
        new MockHttpResponse()
      ]
      let passes = 0

      mockReqs.forEach((req, i) => {
        const res = mockReses[i]
        middlewares.acceptCheckpoint()(req, res, err => {
          if (err) throw err

          passes++
        })
      })

      expect(passes).toBe(2)
      mockReses.forEach(res => {
        expect(res.statusCode).toBe(200)
        expect(res.responseContent).toBe(null)
      })
    })
  })
})

describe("The Middlewares class's getClientIP method,", () => {
  let middlewares = null

  beforeAll(() => {
    middlewares = new Middlewares({
      URL_MAX_LEN: 100,
      loggers: new MockLoggers(),
      corsOpts: { origin: 'http://localhost:3000' },
      requestLoggerStream: { write: process.stdout.write.bind(process.stdout) }
    })
  })

  describe('when behindProxy is false,', () => {
    it('should ignore all relevant headers', () => {
      const mockReq = new MockHttpRequest({
        headers: {
          'x-forwarded-for': '122.193.3.0',
          forwarded: 'for=198.51.100.17;by=203.0.113.60;proto=http;host=example.com'
        },
        socketRemoteAddr: '127.0.0.1'
      })
      let calledNext = false

      middlewares.getClientIP({
        behindProxy: false
      })(mockReq, null, err => {
        if (err) throw err

        calledNext = true
      })

      expect(calledNext).toBe(true)
      expect(mockReq.ip).toBe('127.0.0.1')
    })
  })

  describe('when trustedIPs do not match,', () => {
    it('should ignore all relevant headers', () => {
      const mockReq = new MockHttpRequest({
        headers: {
          'x-forwarded-for': '122.193.3.0'
        },
        socketRemoteAddr: '111.243.193.0',
        forwardedRecords: [{
          for: '198.51.100.17',
          by: '203.0.113.60',
          proto: 'http',
          host: 'example.com'
        }]
      })
      let calledNext = false

      middlewares.getClientIP({
        behindProxy: true,
        trustedIPs: ['93.145.22.0']
      })(mockReq, null, err => {
        if (err) throw err

        calledNext = true
      })

      expect(calledNext).toBe(true)
      expect(mockReq.ip).toBe('111.243.193.0')
    })
  })

  describe('when behindProxy is true and trustedIPs match,', () => {
    it('should use Fowarded records if they exist', () => {
      const mockReq = new MockHttpRequest({
        headers: {
          'x-forwarded-for': '122.193.3.0'
        },
        socketRemoteAddr: '203.0.113.60',
        forwardedRecords: [{
          for: '198.51.100.17',
          by: '203.0.113.60',
          proto: 'http',
          host: 'example.com'
        }]
      })
      let calledNext = false

      middlewares.getClientIP({
        behindProxy: true,
        trustedIPs: ['93.145.22.0', '203.0.113.60']
      })(mockReq, null, err => {
        if (err) throw err

        calledNext = true
      })

      expect(calledNext).toBe(true)
      expect(mockReq.ip).toBe('198.51.100.17')
    })

    it('should use X-Forwarded-For if Forwarded records do not exist', () => {
      const mockReq = new MockHttpRequest({
        headers: {
          'x-forwarded-for': '122.193.3.0'
        },
        socketRemoteAddr: '203.0.113.60'
      })
      let passed = false

      middlewares.getClientIP({
        behindProxy: true,
        trustedIPs: ['203.0.113.60']
      })(mockReq, null, err => {
        if (err) throw err

        passed = true
      })

      expect(passed).toBe(true)
      expect(mockReq.ip).toBe('122.193.3.0')
    })
  })
})
