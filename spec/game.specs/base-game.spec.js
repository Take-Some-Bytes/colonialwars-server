/* eslint-env jasmine */
/**
 * @fileoverview Specs for the BaseGame class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const EventEmitter = require('events').EventEmitter

const Vector2D = require('../../lib/game/physics/vector-2d')
const BaseGame = require('../../lib/game/game-modes/base-game')

const MockSocket = require('../mocks/external/mock-io-socket')

const communications = {
  CONN_UPDATE: 'mock-game-update',
  CONN_REMOVE_PLAYER: 'mock-game-remove-player'
}

describe('The BaseGame class,', () => {
  /**
   * @type {Array<InstanceType<MockSocket>>}
   */
  const playerSockets = []
  let baseGame = null

  it('should construct without error', () => {
    let err = null
    try {
      baseGame = new BaseGame({
        id: 'V3RY-UN1QU3-1D',
        name: 'Base game 1',
        mode: 'Teams',
        maxPlayers: 4,
        description: 'Testing this game.',
        worldLimits: { x: 200, y: 0 },
        teams: [
          {
            name: 'one',
            spawnPosition: new Vector2D(0, 0),
            description: 'Team one.'
          },
          {
            name: 'two',
            spawnPosition: new Vector2D(200, 200),
            description: 'Team two.'
          }
        ],
        graphicsData: {
          theme: 'grass'
        },
        communications: communications,
        playerStats: {
          PLAYER_SPEED: 0.4
        }
      })
      baseGame.init()
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(baseGame).toBeInstanceOf(BaseGame)
  })

  describe('The .addNewPlayer() method,', () => {
    it('should be able to add new players when space is available', () => {
      let err = null
      const newPlayers = [
        {
          meta: {
            name: 'GENERAL LOUDSPEAKER',
            team: 'one'
          },
          socket: MockSocket.create()
        },
        {
          meta: {
            name: 'THISISTHEPOLICE',
            team: 'two'
          },
          socket: MockSocket.create()
        },
        {
          meta: {
            name: 'socialsecurity',
            team: 'one'
          },
          socket: MockSocket.create()
        }
      ]

      try {
        newPlayers.forEach(player => {
          if (baseGame instanceof BaseGame) {
            baseGame.addNewPlayer(player.socket, player.meta)
            playerSockets.push(player.socket)
          }
        })
      } catch (ex) {
        err = ex
      }

      expect(err).toBe(null)
      expect(baseGame.full).toBe(false)
      expect(baseGame.players.size).toBe(3)
      expect(baseGame.clients.size).toBe(3)
      expect(baseGame.currentPlayers).toBe(3)
    })

    it('should not accept players when .closed property is true', () => {
      let err = null
      const player = {
        meta: {
          name: 'Let me in please!',
          team: 'two'
        },
        socket: MockSocket.create()
      }

      try {
        if (baseGame instanceof BaseGame) {
          baseGame.closed = true
          baseGame.addNewPlayer(player.socket, player.meta)
          playerSockets.push(player.socket)
        } else {
          throw new TypeError()
        }
      } catch (ex) {
        err = ex
      }

      expect(err).toBeInstanceOf(RangeError)
      expect(err.message).toBe('Could not add player. Game is either full or closed.')
    })

    it('should not accept players when game is full', () => {
      const errors = []
      const players = [
        { meta: { name: 'FBIOPENUP', team: 'two' }, socket: MockSocket.create() },
        { meta: { name: 'Let me in please!', team: 'two' }, socket: MockSocket.create() }
      ]

      baseGame.closed = false
      players.forEach(player => {
        try {
          if (baseGame instanceof BaseGame) {
            baseGame.addNewPlayer(player.socket, player.meta)
            playerSockets.push(player.socket)
            errors.push(null)
          } else {
            throw new TypeError()
          }
        } catch (ex) {
          errors.push(ex)
        }
      })

      expect(errors.length).toBe(2)
      expect(errors[0]).toBe(null)
      expect(errors[1]).toBeInstanceOf(RangeError)
      expect(baseGame.full).toBe(true)
      expect(baseGame.players.size).toBe(4)
      expect(baseGame.clients.size).toBe(4)
      expect(baseGame.currentPlayers).toBe(4)
    })
  })

  describe('The .sendState() method', () => {
    afterEach(() => {
      playerSockets.forEach(socket => {
        if (socket instanceof MockSocket) {
          if (socket.listenerCount(communications.CONN_UPDATE) > 0) {
            socket.removeAllListeners(communications.CONN_UPDATE)
          }
        }
      })
    })

    it('should send the current game state to all players', done => {
      const allReceived = new EventEmitter()
      const receivedData = []
      allReceived.on('received', () => {
        if (receivedData.length === 4) {
          expect(receivedData.length).toBe(4)
          receivedData.forEach((data, i) => {
            expect(data.id).toBe(playerSockets[i].id)
            expect(JSON.parse(data.data)).toEqual(JSON.parse(JSON.stringify({
              self: baseGame.players.get(data.id)
            })))
            expect(JSON.parse(data.data)).toEqual(JSON.parse(JSON.stringify({
              self: baseGame.players.get(playerSockets[i].id)
            })))
          })
          done()
        }
      })
      if (playerSockets.length === 4 && playerSockets.every(val => val instanceof MockSocket)) {
        playerSockets.forEach(conn => {
          conn.on(communications.CONN_UPDATE, data => {
            receivedData.push({ id: conn.id, data: data })
            allReceived.emit('received')
          })
        })
      }
      if (baseGame instanceof BaseGame) {
        baseGame.sendState()
      }
    })
  })

  describe('The .removePlayer() method,', () => {
    it('should be able to remove the specified player and send the removed player a Socket.IO event', done => {
      const receivedListener = new EventEmitter()
      let received = false
      receivedListener.on('received', () => {
        expect(received).toBe(true)
        expect(baseGame).toBeInstanceOf(BaseGame)
        expect(baseGame.full).toBe(false)
        expect(baseGame.clients.size).toBe(3)
        expect(baseGame.players.size).toBe(3)
        expect(baseGame.currentPlayers).toBe(3)
        done()
      })
      if (playerSockets[2] instanceof MockSocket) {
        const socket = playerSockets[2]
        socket.on(communications.CONN_REMOVE_PLAYER, msg => {
          received = true
          receivedListener.emit('received', msg)
        })
        playerSockets.splice(2, 1)
        if (baseGame instanceof BaseGame) {
          baseGame.removePlayer(socket.id, 'You were kicked from the game.')
        }
      }
    })
  })

  describe('The .update() method,', () => {
    it('should call every player\'s .update() method', () => {
      /**
       * @type {Array<jasmine.Spy<import('../../lib/game/player')['prototype']['update']>>}
       */
      const spies = []
      if (baseGame instanceof BaseGame) {
        const players = new Map(baseGame.players.entries())
        baseGame.players = new Map(Array.from(players.entries()).map(
          entry => {
            const spy = jasmine.createSpy('Player update() method spy', entry[1].update)
            entry[1].update = spy
            spies.push(spy)
            return [entry[0], entry[1]]
          }
        ))
        baseGame.update()
        // Restore original Player implementations.
        baseGame.players = new Map(players.entries())
      }

      expect(spies.length).toBe(3)
      spies.forEach(spy => {
        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy.calls.all().length).toBe(1)
        expect(spy.calls.argsFor(0).every(val => typeof val === 'number')).toBe(true)
      })
    })
  })

  describe('The .clearPlayers() method,', () => {
    it('should be able to clear all players and send an event telling the clients that the game is closing', done => {
      const allReceived = new EventEmitter()
      let receivedCount = 0
      allReceived.on('received', msg => {
        // Make sure the message is correct.
        expect(msg).toBe(JSON.stringify({
          reason: 'Clearing the game room'
        }))
        if (receivedCount === 3) {
          expect(receivedCount).toBe(3)
          expect(baseGame).toBeInstanceOf(BaseGame)
          expect(baseGame.full).toBe(false)
          expect(baseGame.clients.size).toBe(0)
          expect(baseGame.players.size).toBe(0)
          expect(baseGame.currentPlayers).toBe(0)
          done()
        }
      })
      if (playerSockets.length === 3 && playerSockets.every(conn => conn instanceof MockSocket)) {
        playerSockets.forEach(conn => {
          conn.on(communications.CONN_REMOVE_PLAYER, msg => {
            receivedCount++
            allReceived.emit('received', msg)
          })
        })
      }

      if (baseGame instanceof BaseGame) {
        baseGame.clearPlayers('Clearing the game room')
      }
    })
  })
})
