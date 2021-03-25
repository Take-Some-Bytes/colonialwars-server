/* eslint-env node */
/**
 * @fileoverview Index file for the ``websockets`` internal package.
 */

/**
 * Slight wrapper around the ``ws.Server`` class.
 */
exports.WSServer = require('./server')
/**
 * Slight wrapper around the ``ws.WebSocket`` class.
 */
exports.WSConn = require('./conn')
/**
 * Utilities methods for messing with strings.
 */
exports.stringUtils = require('./string-utils')
