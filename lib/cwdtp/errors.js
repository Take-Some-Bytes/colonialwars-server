/* eslint-env node */
/**
 * @fileoverview File of all the errors that could occur when handling CWdTP
 * connections.
 */

export { HandshakeError, HandshakeErrorCode } from 'colonialwars-lib/cwdtp-engine'

/**
 * A map of all the error codes that the WSServer uses.
 */
export const ServerErrorCodes = {
  INVALID_PROTO: Symbol('kInvalidProtocol'),
  CORS_FAILED: Symbol('kCORSFailure'),
  VERIFY_FAILED: Symbol('kVerifyFailed'),
  WS_HANDSHAKE_FAILED: Symbol('kWsHandshakeFailed')
}

/**
 * A map of all invalid event name error codes.
 */
export const InvalidEventNameCode = {
  EMPTY_EVENT_NAME: Symbol('kEmptyEvent'),
  RESERVED_EVENT: Symbol('kReserved')
}

/**
 * A map of all invalid message error codes.
 */
export const InvalidMsgErrorCode = {
  UNEXPECTED_BINARY: Symbol('kUnexpectedBinary'),
  INVALID_CWDTP: Symbol('kInvalidCWDTP')
}

/**
 * Error that may occur if the protocol is not ``pow.cwdtp``.
 */
export class InvalidProtocolError extends Error {}

/**
 * Error that may occur if an endpoint attempts to send a message before the
 * connection opens.
 */
export class NotConnectedError extends Error {}

/**
 * Error that may occur if an endpoint forcefully closes the WebSocket connection
 * before the CWDTP handshake has completed.
 */
export class ConnectionReset extends Error {}

/**
 * Error that may occur if an endpoint attempts to send a message with an
 * invalid event name.
 */
export class InvalidEventName extends Error {
  /**
   * Create a new InvalidEventName error.
   * @param {string} msg The error message
   * @param {symbol} code The error code.
   */
  constructor (msg, code) {
    super(msg)

    this.code = code
  }
}

/**
 * Error that may occur if an endpoint sends an invalid message.
 */
export class InvalidMsgError extends Error {
  /**
   * Create a new InvalidMsgError error.
   * @param {string} msg The error message
   * @param {symbol} code The error code.
   */
  constructor (msg, code) {
    super(msg)

    this.code = code
  }
}
