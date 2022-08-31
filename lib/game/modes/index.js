/* eslint-env node */
/**
 * @fileoverview All the game modes of Colonial Wars.
 */

import _TeamGame from './team-game.js'

export { default as BaseGame } from './base-game.js'
export { _TeamGame as TeamGame }

/**
 * @typedef {Object} CreateGameOpts
 * @prop {string} id
 * @prop {number} stepsPerUpdate
 * @prop {import('colonialwars-lib/mapconfig').ReadonlyMapConfig} mapConfig
 */

/**
 * Creates a new ``TeamGame``, ``KothGame``, or ``SiegeGame`` based on the
 * ``mode`` parameter.
 * @param {string} mode The game mode.
 * @param {CreateGameOpts} opts Options.
 * @returns {_TeamGame}
 */
export function createWithMode (mode, opts) {
  switch (mode.toLowerCase()) {
    case 'teams': {
      const game = new _TeamGame(opts)
      game.init()

      return game
    }
    case 'koth':
    case 'siege':
    default:
      throw new Error('Unrecognized game mode!')
  }
}
