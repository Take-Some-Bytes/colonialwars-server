/* eslint-env node */
/**
 * @fileoverview Server-side constants.
 */

const fs = require('fs')
const path = require('path')
const { deepFreeze } = require('./utils/utils')

module.exports = exports = {
  FALLBACKS: {
    IS_PROD: false,
    PORT: 4000,
    HOST: 'localhost',
    /**
     * TODO: Change the MAX_CLIENTS fallback accordingly.
     * (02/10/2021) Take-Some-Bytes */
    MAX_CLIENTS: 120,
    MAX_GAMES: 3,
    GAME_CONSTANTS: {
      playerStats: {
        PLAYER_SPEED: 0.4
      },
      communications: {
        SOCKET_UPDATE: 'update',
        SOCKET_REMOVE_PLAYER: 'remove-player'
      }
    },
    STARTING_GAME_NUM: 3,
    UPDATE_LOOP_FREQUENCY: 25,
    GAME_CONF_BASE_DIR: path.join(__dirname, 'game/data'),
    GAME_CONFS: fs.readdirSync(path.join(__dirname, 'game/data'))
  },
  APP_OPTS: {
    IMPLEMENTED_METHODS: ['GET', 'HEAD', 'OPTIONS'],
    ALLOWED_METHODS: ['GET', 'HEAD', 'OPTIONS']
  }
}

deepFreeze(module.exports)
