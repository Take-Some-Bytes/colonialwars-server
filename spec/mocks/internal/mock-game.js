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
 * @prop {string} id
 * @prop {string} name
 * @prop {string} mode
 * @prop {string} description
 * @prop {number} maxPlayers
 * @prop {number} currentPlayers
 * @prop {Array<Team>} teams
 */

/**
 * MockGame class.
 */
export default class MockGame {
  /**
   * Creates a new MockGame.
   * @param {MockGameOpts} opts Options.
   */
  constructor (opts) {
    this.teams = opts.teams

    this.maxPlayers = opts.maxPlayers
    this.currentPlayers = opts.currentPlayers

    this.info = {
      id: opts.id,
      name: opts.name,
      mode: opts.mode,
      description: opts.description
    }
  }

  /**
   * Gets some basic info.
   */
  getInfo () {
    return Object.freeze(this.info)
  }

  /**
   * Gets info about teams.
   * @returns {Array<{ name: string, full: boolean }>}
   */
  getTeams () {
    return this.teams.map(t => ({
      name: t.name,
      full: t.currentPlayers === t.maxPlayers
    }))
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
