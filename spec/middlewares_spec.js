/* eslint-env jasmine */
/**
 * @fileoverview Tests for Middlewares class.
 */

const Middlewares = require('../lib/controllers/middlewares')

const MockServerUtils = require('./mocks/internal/mock-server-utils')
const MockHttpRequest = require('./mocks/external/mock-http-request')

describe('The Middlewares class,', () => {
  const mockServerUtils = new MockServerUtils()
  let middlewares = null

  it('should construct without error', () => {
    let err = null
    try {
      middlewares = new Middlewares({
        helmetConfig: {
          EXPECT_CT_OPTS: {}
        },
        serverUtils: mockServerUtils,
        URL_MAX_LEN: 150
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(middlewares).toBeInstanceOf(Middlewares)
  })

  it('should be able to parse Forwarded header', () => {
    const mockReq = new MockHttpRequest({
      headers: {
        forwarded: 'for=198.51.100.17;by=203.0.113.60;proto=http;host=example.com'
      }
    })
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.forwardedParser()(
        mockReq, null, err => {
          if (err) { throw err }
          console.log('FORWARDEDPARSER passed.')
          passed = true
        }
      )
    }

    expect(passed).toBe(true)
    expect(mockServerUtils.numErrorsSent).toBe(0)
    expect(mockReq.forwardedRecords).toBeInstanceOf(Array)
    expect(mockReq.forwardedRecords.length).toBe(1)
  })

  it('should not let request pass system checkpoint if URL is too long', () => {
    const mockReq = new MockHttpRequest({
      url:
        '/thisurlmustbeveryveryveryveryveryveryveryveryverylongorthis' +
        'requestwillpassandwewantittonotpass?iamright=1&thiswillpass=0' +
        '&pleaseletthisnotpass=pleasepleaseplease',
      ip: '123.45.67.89',
      method: 'GET'
    })
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.sysCheckpoint(
        ['GET', 'HEAD']
      )(mockReq, null, err => {
        if (err) throw err

        console.log('SYSCHECKPOINT 1 passed.')
        passed = true
      }
      )
    }

    expect(passed).toBe(false)
    expect(mockServerUtils.numErrorsSent).toBe(1)
    expect(mockServerUtils.errors['Error-1'].error.httpOpts.status).toBe(414)
  })

  it('should not let request pass system checkpoint if HTTP method is not implemented', () => {
    const mockReq = new MockHttpRequest({
      url: '/i-am-not-too-long.html',
      ip: '111.222.33.44',
      method: 'POST'
    })
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.sysCheckpoint(
        ['GET', 'HEAD']
      )(mockReq, null, err => {
        if (err) throw err

        console.log('SYSCHECKPOINT 2 passed.')
        passed = true
      })
    }

    expect(passed).toBe(false)
    expect(mockServerUtils.numErrorsSent).toBe(2)
    expect(mockServerUtils.errors['Error-2'].error.httpOpts.status).toBe(501)
  })

  it('should let valid request pass system checkpoint', () => {
    const mockReq = new MockHttpRequest({
      url: '/index.valid.html',
      ip: '98.76.54.32',
      method: 'GET'
    })
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.sysCheckpoint(
        ['GET', 'HEAD']
      )(mockReq, null, err => {
        if (err) throw err

        console.log('SYSCHECKPOINT 3 passed.')
        passed = true
      })
    }

    expect(passed).toBe(true)
    expect(mockServerUtils.numErrorsSent).toBe(2)
    expect(mockServerUtils.errors['Error-3']).toBe(undefined)
  })

  it('should not let request pass accept checkpoint on accept mismatch', () => {
    const mockReq = new MockHttpRequest({
      headers: {
        accept: 'text/html'
      },
      ip: '32.104.212.0'
    })
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.acceptCheckpoint()(mockReq, null, err => {
        if (err) throw err

        console.log('ACCEPTCHECKPOINT 1 passed.')
        passed = true
      })
    }

    expect(passed).toBe(false)
    expect(mockServerUtils.numErrorsSent).toBe(3)
    expect(mockServerUtils.errors['Error-3'].error.httpOpts.status).toBe(406)
  })

  it('should let valid requests pass accept checkpoint', () => {
    const mockReqs = [
      new MockHttpRequest({ headers: { accept: '*/*' }, ip: '23.110.32.0' }),
      new MockHttpRequest({ headers: { accept: 'text/html, */*' }, ip: '49.103.0.223' })
    ]
    let passes = 0

    mockReqs.forEach((req, i) => {
      if (middlewares instanceof Middlewares) {
        console.log()
        middlewares.acceptCheckpoint()(req, null, err => {
          if (err) throw err

          console.log(`ACCEPTCHECkPOINT ${i + 2} passed`)
          passes++
        })
      }
    })

    expect(passes).toBe(2)
    expect(mockServerUtils.numErrorsSent).toBe(3)
    expect(mockServerUtils.errors['Error-4']).toBe(undefined)
    expect(mockServerUtils.errors['Error-5']).toBe(undefined)
  })
})

describe('The Middlewares class\'s getClientIP method,', () => {
  let middlewares = null

  beforeAll(() => {
    middlewares = new Middlewares({
      helmetConfig: {
        EXPECT_CT_OPTS: {}
      },
      serverUtils: new MockServerUtils(),
      URL_MAX_LEN: 150
    })
  })

  it('should ignore all relevant headers when behindProxy is set to false', () => {
    const mockReq = new MockHttpRequest({
      headers: {
        'x-forwarded-for': '122.193.3.0',
        forwarded: 'for=198.51.100.17;by=203.0.113.60;proto=http;host=example.com'
      },
      socketRemoteAddr: '127.0.0.1'
    })
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.getClientIP({
        behindProxy: false
      })(mockReq, null, err => {
        if (err) throw err

        console.log('GETCLIENTIP 1 passed.')
        passed = true
      })
    }

    expect(passed).toBe(true)
    expect(mockReq.ip).toBe('127.0.0.1')
  })

  it('should ignore all relevant headers when trustedIPs do not match', () => {
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
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.getClientIP({
        behindProxy: true,
        trustedIPs: ['93.145.22.0']
      })(mockReq, null, err => {
        if (err) throw err

        console.log('GETCLIENTIP 2 passed.')
        passed = true
      })
    }

    expect(passed).toBe(true)
    expect(mockReq.ip).toBe('111.243.193.0')
  })

  it('should use parsed Forwarded records, when behindProxy is true and trustedIPs match', () => {
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
    let passed = false

    if (middlewares instanceof Middlewares) {
      console.log()
      middlewares.getClientIP({
        behindProxy: true,
        trustedIPs: ['93.145.22.0', '203.0.113.60']
      })(mockReq, null, err => {
        if (err) throw err

        console.log('GETCLIENTIP 3 passed.')
        passed = true
      })
    }

    expect(passed).toBe(true)
    expect(mockReq.ip).toBe('198.51.100.17')
  })

  it(
    'should use X-Forwarded-For when: Forwarded records don\'t exist, behindProxy is true and trustedIPs match', () => {
      const mockReq = new MockHttpRequest({
        headers: {
          'x-forwarded-for': '122.193.3.0'
        },
        socketRemoteAddr: '203.0.113.60'
      })
      let passed = false

      if (middlewares instanceof Middlewares) {
        console.log()
        middlewares.getClientIP({
          behindProxy: true,
          trustedIPs: ['203.0.113.60']
        })(mockReq, null, err => {
          if (err) throw err

          console.log('GETCLIENTIP 4 passed.')
          passed = true
        })

        expect(passed).toBe(true)
        expect(mockReq.ip).toBe('122.193.3.0')
      }
    }
  )
})
