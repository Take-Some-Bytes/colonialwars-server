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
    SERVER_CONN_TIMEOUT: 6000,
    /**
     * TODO: Change the MAX_CLIENTS fallback accordingly.
     * (02/10/2021) Take-Some-Bytes */
    MAX_CLIENTS: 120,
    MAX_GAMES: 3,
    GAME_CONSTANTS: {
      playerStats: {
        PLAYER_SPEED: 0.9
      },
      /**
       * TODO: Migrate all communications to the COMMUNICATIONS constant below.
       * (04/27/2021) Take-Some-Bytes */
      communications: {
        CONN_UPDATE: 'update',
        CONN_REMOVE_PLAYER: 'remove-player'
      }
    },
    STARTING_GAME_NUM: 3,
    UPDATE_LOOP_FREQUENCY: 10,
    GAME_CONF_BASE_DIR: path.join(__dirname, 'game/data'),
    GAME_CONFS: fs.readdirSync(path.join(__dirname, 'game/data')),
    GAME_AUTH_SECRET: '11dev-game-auth-secret$$',
    AUTH_STORE_CONFIG: {
      MAX_ENTRIES: 10000,
      // Six seconds should be enough for legit clients to connect to
      // the actual game.
      MAX_ENTRY_AGE: 6000,
      PRUNE_INTERVAL: 20000
    }
  },
  APP_OPTS: {
    IMPLEMENTED_METHODS: ['GET', 'HEAD', 'OPTIONS'],
    ALLOWED_METHODS: ['GET', 'HEAD', 'OPTIONS']
  },
  COMMUNICATIONS: {
    CONN_UPDATE: 'update',
    CONN_REMOVE_PLAYER: 'remove-player',
    CONN_READY: 'ready',
    CONN_READY_ACK: 'ready-ack',
    CONN_DISCONNECT: 'disconnect',
    CONN_CLIENT_ACTION: 'client-action'
  }
}

deepFreeze(module.exports)
