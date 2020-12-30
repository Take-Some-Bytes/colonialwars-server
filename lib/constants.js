/* eslint-env node */
/**
 * @fileoverview Server-side constants.
 */

const { deepFreeze } = require('./utils/utils')

module.exports = exports = {
  FALLBACKS: {
    IS_PROD: false,
    PORT: 4000,
    HOST: 'localhost'
  },
  APP_OPTS: {
    IMPLEMENTED_METHODS: ['GET', 'HEAD', 'OPTIONS'],
    ALLOWED_METHODS: ['GET', 'HEAD', 'OPTIONS']
  }
}

deepFreeze(module.exports)
