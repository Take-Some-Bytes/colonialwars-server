/* eslint-env jasmine */
/**
 * @fileoverview Specs for the GameServer class, which manages WebSocket
 * connections and manipulating game clients.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const events = require('events')

const GameServer = require('../lib/game-server')

const MockLoggers = require('./mocks/internal/mock-loggers')
const MockRequest = require('./mocks/external/mock-http-request')

const mockDB = new Map()
mockDB.del = mockDB.delete

const mockConfig = { get: () => null }

/**
 * @typedef {Object} MockWSConn
 * @prop {jasmine.Spy<(code: number, reason: string) => void>} terminate
 * @prop {jasmine.Spy<(code: number, reason: string, wasError: boolean) => void>} disconnect
 */

/**
 * Creates a mock WSConn object.
 * @returns {MockWSConn & events.EventEmitter}
 */
function createMockConn () {
  const mockConn = {
    terminate: jasmine.createSpy('terminateMock', (code, reason) => {}),
    disconnect: jasmine.createSpy('disconnectMock', (code, reason, wasError) => {})
  }

  Object.setPrototypeOf(mockConn, events.EventEmitter.prototype)

  return mockConn
}

/**
 * Creates and returns a mock GameServer and request for testing the _onConnection method.
 * @param {any} mockGame The mock game instance.
 * @returns {[InstanceType<GameServer>, InstanceType<MockRequest>]}
 */
function createMockServerAndReq (mockGame) {
  const mockReq = new MockRequest({
    url: '/play?auth=match_today&game=1&playername=Hi&playerteam=british'
  })
  const gmServer = new GameServer({
    config: mockConfig,
    authStore: mockDB,
    gamelogger: new MockLoggers().get('gamelogger'),
    middlewares: {
      forwardedParser: () => () => {},
      getClientIP: () => () => {}
    },
    manager: {
      getGame: _ => mockGame,
      playerExists: _ => false,
      hasTeam: (..._) => true
    }
  })

  return [gmServer, mockReq]
}

describe('The GameServer class,', () => {
  it('should have a method that tries to identify client IP', () => {
    const forwardedSpy = jasmine.createSpy('forwardedParserRet', (..._) => {})
    const getClientIPSpy = jasmine.createSpy('getClientIPRet', (..._) => {})
    const gmServer = new GameServer({
      config: mockConfig,
      middlewares: {
        forwardedParser: () => forwardedSpy,
        getClientIP: () => getClientIPSpy
      }
    })

    const result = gmServer._getClientIP({})

    expect(result).toBe('Unknown IP.')
    expect(forwardedSpy).toHaveBeenCalled()
    expect(getClientIPSpy).toHaveBeenCalled()
  })

  describe('when verifying client,', () => {
    afterEach(() => {
      mockDB.clear()
    })

    it('should not succeed if request URL is missing fields', done => {
      const mockReq = new MockRequest({ url: '/play?game=1&missing=1' })
      const gmServer = new GameServer({
        config: mockConfig,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('EMISSINGFIELDS')
        expect(e.status).toBe(400)
        done()
      })
    })

    it('should not succeed if no auth entry is present', done => {
      const mockReq = new MockRequest({
        url: '/play?auth=100&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('ENOTAUTH')
        expect(e.status).toBe(401)
        done()
      })
    })

    it('should not succeed if auth tokens do not match', done => {
      mockDB.set('Hi', JSON.stringify({ auth: 'haha_no_match' }))

      const mockReq = new MockRequest({
        url: '/play?auth=nomatch&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('ENOTAUTH')
        expect(e.status).toBe(401)
        done()
      })
    })

    it('should not succeed if requested parameters do not match', done => {
      mockDB.set('Hi', JSON.stringify({
        auth: 'match_today',
        game: 2,
        name: 'nomatch!',
        team: 'not british'
      }))

      const mockReq = new MockRequest({
        url: '/play?auth=match_today&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('ENOMATCH')
        expect(e.status).toBe(400)
        done()
      })
    })

    it('should not succeed if a player with the specified name already exists', done => {
      mockDB.set('Hi', JSON.stringify({
        auth: 'match_today',
        game: '1',
        name: 'Hi',
        team: 'british'
      }))

      const mockReq = new MockRequest({
        url: '/play?auth=match_today&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        },
        manager: {
          getGame: id => ({}),
          playerExists: name => name === 'Hi'
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('EEXISTS')
        expect(e.status).toBe(409)
        done()
      })
    })

    it('should not succeed if the requested game does not exist', done => {
      mockDB.set('Hi', JSON.stringify({
        auth: 'match_today',
        game: '1',
        name: 'Hi',
        team: 'british'
      }))

      const mockReq = new MockRequest({
        url: '/play?auth=match_today&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        },
        manager: {
          getGame: id => id === 'game-1' ? null : {},
          playerExists: _ => false
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('ENOEXIST')
        expect(e.status).toBe(400)
        done()
      })
    })

    it('should not succeed if the specified team does not exist', done => {
      mockDB.set('Hi', JSON.stringify({
        auth: 'match_today',
        game: '1',
        name: 'Hi',
        team: 'british'
      }))

      const mockReq = new MockRequest({
        url: '/play?auth=match_today&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        },
        manager: {
          getGame: id => ({}),
          playerExists: _ => false,
          hasTeam: (_, team) => team !== 'british'
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('ENOEXIST')
        expect(e.status).toBe(400)
        done()
      })
    })

    it('should not succeed if game is closed', done => {
      mockDB.set('Hi', JSON.stringify({
        auth: 'match_today',
        game: '1',
        name: 'Hi',
        team: 'british'
      }))

      const mockReq = new MockRequest({
        url: '/play?auth=match_today&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        },
        manager: {
          getGame: id => ({ closed: true }),
          playerExists: _ => false,
          hasTeam: (..._) => true
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeInstanceOf(Error)
        expect(e.code).toBe('ECLOSED')
        expect(e.status).toBe(500)
        done()
      })
    })

    it('should succeed if all checks pass', done => {
      mockDB.set('Hi', JSON.stringify({
        auth: 'match_today',
        game: '1',
        name: 'Hi',
        team: 'british'
      }))

      const mockReq = new MockRequest({
        url: '/play?auth=match_today&game=1&playername=Hi&playerteam=british'
      })
      const gmServer = new GameServer({
        config: mockConfig,
        authStore: mockDB,
        middlewares: {
          forwardedParser: () => () => {},
          getClientIP: () => () => {}
        },
        manager: {
          getGame: id => ({ closed: false }),
          playerExists: _ => false,
          hasTeam: (..._) => true
        }
      })

      gmServer._verifyClient(mockReq, e => {
        expect(e).toBeNull()
        done()
      })
    })
  })

  describe('when a new connection is received,', () => {
    it('should terminate the connection if CONN_READY is not received within 10s', () => {
      jasmine.clock().install()

      const mockConn = createMockConn()
      const [gmServer, mockReq] = createMockServerAndReq({})

      gmServer._onConnection(mockConn, mockReq)

      jasmine.clock().tick(11000)
      jasmine.clock().uninstall()

      expect(mockConn.terminate).toHaveBeenCalledWith(4004, 'Timeout')
    })

    it('should add player to the specified game if client is ready', () => {
      const mockConn = createMockConn()
      const mockGame = {
        closed: false,
        addPlayer: jasmine.createSpy('addPlayerMock', (conn, meta) => {}),
        getMapData: jasmine.createSpy('getMapDataMock', () => ({})).and.callThrough()
      }
      const [gmServer, mockReq] = createMockServerAndReq(mockGame)

      gmServer._onConnection(mockConn, mockReq)

      mockConn.emit('ready')

      expect(mockGame.addPlayer).toHaveBeenCalled()
      expect(mockGame.getMapData).toHaveBeenCalled()
    })

    describe('when a client action is received,', () => {
      it('should terminate the connection if player does not exist', () => {
        const mockConn = createMockConn()
        const mockGame = {
          closed: false,
          addPlayer: jasmine.createSpy('addPlayerMock', (conn, meta) => {}),
          getPlayerByID: () => null,
          removePlayer: jasmine.createSpy('removePlayerMock', (connId, reason, sendReason) => {}),
          getMapData: jasmine.createSpy('getMapDataMock', () => ({})).and.callThrough()
        }
        const [gmServer, mockReq] = createMockServerAndReq(mockGame)

        gmServer._onConnection(mockConn, mockReq)

        mockConn.emit('ready')
        mockConn.emit('client-action')

        expect(mockGame.removePlayer).toHaveBeenCalled()
        expect(mockConn.terminate).toHaveBeenCalled()
      })

      it('should add input to queue if player does exist', () => {
        const mockConn = createMockConn()
        mockConn.id = '1'
        const mockGame = {
          closed: false,
          addPlayer: jasmine.createSpy('addPlayerMock', (conn, meta) => {}),
          addInputTo: jasmine.createSpy('addInputToMock', input => {}),
          removePlayer: jasmine.createSpy('removePlayerMock', (connId, reason, sendReason) => {}),
          getMapData: jasmine.createSpy('getMapDataMock', () => ({})).and.callThrough()
        }
        const [gmServer, mockReq] = createMockServerAndReq(mockGame)

        gmServer._onConnection(mockConn, mockReq)

        mockConn.emit('ready')
        mockConn.emit('client-action', {
          up: true
        })

        expect(mockGame.addInputTo).toHaveBeenCalledWith('1', {
          up: true
        })
      })
    })

    it('should remove a player when disconnect happens', () => {
      const mockConn = createMockConn()
      mockConn.id = '1'
      const mockPlayer = {
        addInputToQueue: jasmine.createSpy('addInputToQueueMock', input => {})
      }
      const mockGame = {
        closed: false,
        addPlayer: jasmine.createSpy('addPlayerMock', (conn, meta) => {}),
        getPlayerByID: () => mockPlayer,
        removePlayer: jasmine.createSpy('removePlayerMock', (connId, reason, sendReason) => {}),
        getMapData: jasmine.createSpy('getMapDataMock', () => ({})).and.callThrough()
      }
      const [gmServer, mockReq] = createMockServerAndReq(mockGame)

      gmServer._onConnection(mockConn, mockReq)

      mockConn.emit('ready')
      mockConn.emit('disconnect')

      expect(mockGame.removePlayer).toHaveBeenCalledWith(mockConn)
    })
  })
})
