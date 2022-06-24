/* eslint-env node */
/**
 * @fileoverview All the game modes of Colonial Wars.
 */

const BaseGame = require('./base-game')
const TeamGame = require('./team-game')

exports.BaseGame = BaseGame
exports.TeamGame = TeamGame

/**
 * Creates a new ``TeamGame``, ``KothGame``, or ``SiegeGame`` based on the
 * ``mode`` parameter.
 * @param {string} mode The game mode.
 * @param {{ id: string, mapConfig: import('../map-config') }} opts Options.
 * @returns {InstanceType<TeamGame>}
 */
exports.createWithMode = (mode, opts) => {
  switch (mode.toLowerCase()) {
    case 'teams':
      return new TeamGame(opts)
    case 'koth':
    case 'siege':
    default:
      throw new Error('Unrecognized game mode!')
  }
}
