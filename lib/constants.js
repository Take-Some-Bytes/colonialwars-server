/* eslint-env node */
/**
 * @fileoverview Server-side constants.
 */

const fs = require('fs')
const path = require('path')
const { deepFreeze } = require('./utils/utils')

module.exports = exports = {
  FALLBACKS: {
    ALLOWED_ORIGINS: [
      'http://0.0.0.0:5555',
      'http://localhost:5555',
      'http://colonialwars.localhost:5555'
    ],
    LOGGING_TRANSPORTS: [
      { type: 'console', config: { level: 'debug' } }
    ],
    TRUSTED_IPS: [],
    IS_PROD: false,
    PORT: 4000,
    HOST: 'localhost',
    SERVER_CONN_TIMEOUT: 6000,
    /**
     * TODO: Change the MAX_CLIENTS fallback accordingly.
     * (02/10/2021) Take-Some-Bytes */
    MAX_CLIENTS: 120,
    MAX_GAMES: 3,
    PLAYER_SPEED: 0.9,
    STARTING_GAME_NUM: 3,
    UPDATE_LOOP_FREQUENCY: 10,
    GAME_CONF_BASE_DIR: path.join(__dirname, 'game/data'),
    GAME_CONFS: fs.readdirSync(path.join(__dirname, 'game/data')),
    GAME_AUTH_SECRET: '11dev-game-auth-secret$$',
    AUTH_STORE_MAX_ENTRIES: 10000,
    AUTH_STORE_MAX_ENTRY_AGE: 6000
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
