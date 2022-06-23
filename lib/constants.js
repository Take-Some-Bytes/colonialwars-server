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
  },
  REGEXP: {
    TEAM_NAME: /^[A-Za-z0-9]*$/,
    DESCRIPTION_SINGLE_LINE: /^[A-z (),.&!?;:0-9]*$/,
    DESCRIPTION_MULTI_LINE: /^(?:[A-z (),.&!?;:0-9]|(?:\r\n|\r|\n))*$/
  },
  // Some validation regexps.
  // Lowercase letters, numbers, and underscores only.
  ID_REGEXP: /^(?:[a-z0-9]|_)+$/,
  // Only alphanumerical characters and spaces.
  NAME_REGEXP: /^(?:[A-Za-z0-9]| ){0,31}$/,
  MAP_CONFIG_LIMITS: {
    MIN_MAP_SIZE: 50,
    MAX_MAP_SIZE: 200,
    MIN_DEFAULT_HEIGHT: 0,
    MAX_DEFAULT_HEIGHT: 2,
    MIN_TEAMS: 2,
    MAX_TEAMS: 8,
    MIN_PLAYERS_MAP: 2,
    MAX_PLAYERS_ON_TEAM: 20,
    MIN_PLAYERS_ON_TEAM: 1,
    MAX_TEAM_NAME_LEN: 30,
    MAX_TEAM_DESC_LEN: 150,
    MAX_MAP_NAME_LEN: 30,
    MAX_MAP_DESC_LEN: 5000,
    // Limits for graphics, modifiers, abilities, units, buildings, obstacles.
    MIN_MAP_GRAPHICS: 0,
    MAX_MAP_GRAPHICS: 1500,
    MAX_MAP_MODIFIERS: 1500,
    MAX_MODIFIER_DESC_LEN: 150,
    MAX_AURAS_PER_MODIFIER: 10,
    MIN_AURA_RANGE: 1,
    MAX_AURA_RANGE: 200,
    MAX_MODIFICATIONS_PER_MODIFIER: 50,
    MIN_PLAYER_SPEED: 0.1,
    MAX_PLAYER_SPEED: 10
  },
  VALID_TILE_TYPES: ['grass', 'sand', 'rock'],
  VALID_GAME_MODES: ['teams', 'koth', 'siege'],
  VALID_ANIMATIONS: [
    'die',
    'idle',
    'walk',
    'busy',
    'cast',
    'attack',
    'reload',
    'busyDamaged1',
    'busyDamaged2'
  ]
}

deepFreeze(module.exports)
