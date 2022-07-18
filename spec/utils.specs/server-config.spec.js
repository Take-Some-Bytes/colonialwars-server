/* eslint-env jasmine */
/**
 * @fileoverview Specs for the ServerConfig class.
 */

/**
 * @typedef {import('jasmine')} jasmine
 */

import { strict as assert } from 'assert'

import ServerConfig from '../../lib/utils/server-config.js'

const defaults = {
  ALLOWED_ORIGINS: [],
  LOGGING_TRANSPORTS: [],
  TRUSTED_IPS: [],
  IS_PROD: false,
  PORT: 4000,
  HOST: 'localhost',
  SERVER_CONN_TIMEOUT: 6000,
  MAX_CLIENTS: 120,
  MAX_GAMES: 3,
  PLAYER_SPEED: 0.9,
  STARTING_GAME_NUM: 3,
  UPDATE_LOOP_FREQUENCY: 10,
  GAME_CONF_BASE_DIR: '/f/c',
  GAME_CONFS: [],
  GAME_AUTH_SECRET: '11dev-game-auth-secret$$',
  AUTH_STORE_MAX_ENTRIES: 10000,
  AUTH_STORE_MAX_ENTRY_AGE: 6000
}

describe('The ServerConfig class,', () => {
  describe('when validating configurations,', () => {
    it('should throw an error if invalid types are received', () => {
      function shouldThrow () {
        /* eslint-disable-next-line no-new */
        new ServerConfig({
          config: {
            ALLOWED_ORIGINS: 'fds   ['
          },
          fallbacks: defaults
        })
      }

      expect(shouldThrow).toThrowError(assert.AssertionError)
    })
    it('should throw an error if something is NaN', () => {
      function shouldThrow () {
        /* eslint-disable-next-line no-new */
        new ServerConfig({
          config: {
            PORT: NaN,
            SERVER_CONN_TIMEOUT: NaN
          },
          fallbacks: defaults
        })
      }

      expect(shouldThrow).toThrowError(assert.AssertionError)
    })
    it('should throw an error if a numeric value is out of range', () => {
      function shouldThrow () {
        /* eslint-disable-next-line no-new */
        new ServerConfig({
          config: {
            // One hundre times a second?
            UPDATE_LOOP_FREQUENCY: 100
          },
          fallbacks: defaults
        })
      }

      expect(shouldThrow).toThrowError(assert.AssertionError)
    })
    it('should throw an error if HOST is not a valid hostname', () => {
      function shouldThrow () {
        /* eslint-disable-next-line no-new */
        new ServerConfig({
          config: {
            HOST: '0033jdl42^)!"~?'
          },
          fallbacks: defaults
        })
      }

      expect(shouldThrow).toThrowError(assert.AssertionError)
    })
  })

  it('should be read-only after construction', () => {
    function shouldThrow () {
      // Should probably do this on top of every file
      'use strict'

      const conf = new ServerConfig({
        config: {},
        fallbacks: defaults
      })
      conf.PORT = 10000
    }

    expect(shouldThrow).toThrowError(TypeError)
  })
})
