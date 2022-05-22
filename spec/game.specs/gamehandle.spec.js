/* eslint-env jasmine */
/**
 * @fileoverview Specs for the GameHandle class, which represents a handle to
 * an arbritrary game.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const constants = require('../../lib/constants')
const GameHandle = require('../../lib/game/gamehandle')

/**
 * Creates a GameHandle for specs.
 * @param {(a: any) => void} setAction Sets the requested action.
 * @returns {GameHandle}
 */
function createHandle (setAction) {
  return new GameHandle({
    gameId: 'game-0',
    msgIdPrefix: 'f',
    async sendAction (a) {
      setAction(a)
      return {
        msgId: 'f0',
        type: constants.THREADS.MSG_TYPE.ActionResponse,
        data: { success: true }
      }
    }
  })
}

/**
 * Creates a GameHandle that will pretend every action fails.
 * @returns {GameHandle}
 */
function createUnsuccessfulHandle () {
  return new GameHandle({
    gameId: 'game-0',
    msgIdPrefix: 'f',
    async sendAction (_) {
      return {
        msgId: 'f0',
        type: constants.THREADS.MSG_TYPE.ActionResponse,
        data: { success: false }
      }
    }
  })
}

describe('The GameHandle class,', () => {
  describe('when adding players,', () => {
    it('should throw an error if space is available in the game', async () => {
      const handle = createUnsuccessfulHandle()

      await expectAsync(
        handle.players.reserve()
      ).toBeRejected()
      await expectAsync(
        handle.players.add({ name: 'testing', team: 'team' })
      ).toBeRejected()
    })

    it('should be able to reserve a spot in a game', async () => {
      let action = null
      const handle = createHandle(a => (action = a))

      await handle.players.reserve()

      expect(action).not.toBeNull()
      expect(action).toEqual({
        msgId: 'f0',
        type: constants.THREADS.MSG_TYPE.ActionRequest,
        data: {
          receiverId: 'game-0',
          action: constants.GAME_HANDLE.ACTIONS.ReservePlayer
        }
      })
    })

    it('should be able to add a player into a game', async () => {
      let action = null
      const handle = createHandle(a => (action = a))

      await handle.players.add({ name: 'testing', team: 'ThatTeam' })

      expect(action).not.toBeNull()
      expect(action).toEqual({
        msgId: 'f0',
        type: constants.THREADS.MSG_TYPE.ActionRequest,
        data: {
          receiverId: 'game-0',
          action: constants.GAME_HANDLE.ACTIONS.AddPlayer,
          name: 'testing',
          team: 'ThatTeam'
        }
      })
    })
  })

  describe('when removing players,', () => {
    it('should throw an error if player does not exist', async () => {
      const handle = createUnsuccessfulHandle()

      await expectAsync(
        handle.players.remove('dont exist')
      ).toBeRejected()
    })

    it('should be able to remove a player from a game', async () => {
      let action = null
      const handle = createHandle(a => (action = a))

      await handle.players.remove('testing')

      expect(action).not.toBeNull()
      expect(action).toEqual({
        msgId: 'f0',
        type: constants.THREADS.MSG_TYPE.ActionRequest,
        data: {
          receiverId: 'game-0',
          action: constants.GAME_HANDLE.ACTIONS.RemovePlayer,
          name: 'testing'
        }
      })
    })

    it('should be able to clear all players from a game', async () => {
      let action = null
      const handle = createHandle(a => (action = a))

      await handle.players.clear()

      expect(action).not.toBeNull()
      expect(action).toEqual({
        msgId: 'f0',
        type: constants.THREADS.MSG_TYPE.ActionRequest,
        data: {
          receiverId: 'game-0',
          action: constants.GAME_HANDLE.ACTIONS.ClearPlayers
        }
      })
    })
  })

  it('should be able to get status of game', async () => {
    let action = null
    const handle = new GameHandle({
      gameId: 'game-0',
      msgIdPrefix: 'f',
      async sendAction (a) {
        action = a
        return {
          msgId: 'f0',
          type: constants.THREADS.MSG_TYPE.ActionResponse,
          data: {
            status: 'closed'
          }
        }
      }
    })

    const res = await handle.getStatus()

    expect(action).not.toBeNull()
    expect(res).toBe('closed')
    expect(action).toEqual({
      msgId: 'f0',
      type: constants.THREADS.MSG_TYPE.ActionRequest,
      data: {
        receiverId: 'game-0',
        action: constants.GAME_HANDLE.ACTIONS.GetStatus
      }
    })
  })
})
