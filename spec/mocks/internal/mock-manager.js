/* eslint-env node */
/**
 * @fileoverview Mock Manager class.
 */

import events from 'events'

/**
 * @typedef {import('./mock-game')} MockGame
 *
 * @typedef {Object} MockManagerOpts
 * @prop {Map<string, MockGame>} games
 * @prop {Array<string>} existingPlayers
 */

/**
 * MockManager class.
 */
export default class MockManager extends events.EventEmitter {
  /**
   * Creates a new MockManager.
   * @param {MockManagerOpts} opts Options.
   */
  constructor (opts) {
    super()

    this.games = opts.games
    this.existingPlayers = opts.existingPlayers || []
  }

  /**
   * Returns true if a player with the given name exists.
   * @param {string} name The name to check for.
   * @returns {boolean}
   */
  playerExists (name) {
    return this.existingPlayers.includes(name)
  }

  /**
   * Gets the game with the specified ID.
   * @param {string} gameID The game's ID.
   * @returns {MockGame}
   */
  getGame (gameID) {
    return this.games.get(gameID)
  }
}
