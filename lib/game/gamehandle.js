/* eslint-env node */
/**
 * @fileoverview Abstraction over getting a game's status and manipulating its players.
 */

const constants = require('../constants')

/**
 * @typedef {Object} CommsMsg
 * @prop {number} msgId
 * @prop {symbol} type
 * @prop {null|Record<string, any>} data
 *
 * @typedef {Object} PlayersHandle
 * @prop {() => Promise<void>} clear
 * @prop {() => Promise<void>} reserve
 * @prop {(name: string) => Promise<void>} remove
 * @prop {(opts: { name: string, team: string }) => Promise<void>} add
 *
 * @typedef {Object} GameHandleOpts
 * @prop {string} gameId The game to send querys to.
 * @prop {string} msgIdPrefix A prefix to give message IDs.
 * @prop {(action: CommsMsg) => Promise<CommsMsg>} sendAction Function to
 * actually perform message sending.
 */

/**
 * GameHandle class.
 *
 * Handles (no pun intended) manipulating players and querying game status.
 */
class GameHandle {
  /**
   * Creates a new GameHandle object.
   *
   * GameHandles take care of communicating to the correct game about modifying players
   * and query game status.
   * @param {GameHandleOpts} opts Options.
   */
  constructor (opts) {
    this.gameId = opts.gameId
    this.msgIdPrefix = opts.msgIdPrefix
    this.sendAction = opts.sendAction

    this.msgId = 0
  }

  /**
   * Private helpers method to send an action.
   * @param {any} data The data to send.
   * @returns {Promise<CommsMsg>}
   * @private
   */
  _sendAction (data) {
    const id = `${this.msgIdPrefix}${this.msgId}`

    this.msgId++

    return this.sendAction({
      msgId: id,
      type: constants.THREADS.MSG_TYPE.ActionRequest,
      data: {
        receiverId: this.gameId,
        ...data
      }
    })
  }

  /**
   * Manipulating players in this game.
   * @returns {PlayersHandle}
   */
  get players () {
    return {
      add: async opts => {
        rejectIfUnsuccessful(await this._sendAction({
          action: constants.GAME_HANDLE.ACTIONS.AddPlayer,
          name: opts.name,
          team: opts.team
        }), 'Game is full!')
      },
      remove: async name => {
        rejectIfUnsuccessful(await this._sendAction({
          action: constants.GAME_HANDLE.ACTIONS.RemovePlayer,
          name
        }), 'Player does not exist!')
      },
      reserve: async () => {
        rejectIfUnsuccessful(await this._sendAction({
          action: constants.GAME_HANDLE.ACTIONS.ReservePlayer
        }), 'Game is full!')
      },
      // Infallible
      clear: async () => {
        await this._sendAction({
          action: constants.GAME_HANDLE.ACTIONS.ClearPlayers
        })
      }
    }
  }

  /**
   * Gets the status of the game.
   * @returns {Promise<string>}
   */
  async getStatus () {
    const res = await this._sendAction({
      action: constants.GAME_HANDLE.ACTIONS.GetStatus
    })

    this.msgId++

    return res.data.status
  }
}

/**
 * Helper function to reject with a message if the message reports an action
 * to be unsuccessful.
 * @param {CommsMsg} res The response message.
 * @param {string} errMsg The error message to reject with.
 */
function rejectIfUnsuccessful (res, errMsg) {
  if (!res.data.success) {
    throw new Error(errMsg)
  }
}

module.exports = GameHandle
