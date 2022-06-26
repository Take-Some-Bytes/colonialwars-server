/* eslint-env node */
/**
 * @fileoverview Mock Game class.
 */

/**
 * @typedef {Object} Team
 * @prop {string} name
 * @prop {number} maxPlayers
 * @prop {number} currentPlayers
 *
 * @typedef {Object} MockGameOpts
 * @prop {number} maxPlayers
 * @prop {number} currentPlayers
 * @prop {Array<Team>} teams
 */

/**
 * MockGame class.
 */
class MockGame {
  /**
   * Creates a new MockGame.
   * @param {MockGameOpts} opts Options.
   */
  constructor (opts) {
    this.teams = opts.teams

    this.maxPlayers = opts.maxPlayers
    this.currentPlayers = opts.currentPlayers
  }

  /**
   * Returns true if this game has the specified team.
   * @param {string} team The name of the team.
   * @returns {boolean}
   */
  hasTeam (team) {
    return this.teams.find(t => t.name === team)
  }

  /**
   * Returns true if the team specified is full
   * @param {string} teamName The name of the team.
   * @returns {boolean}
   */
  teamFull (teamName) {
    const team = this.teams.find(t => t.name === teamName)

    return team.currentPlayers === team.maxPlayers
  }
}

module.exports = MockGame
