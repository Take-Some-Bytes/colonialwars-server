/* eslint-env node */
/**
 * @fileoverview File of all the errors that could occur when handling CWdTP
 * connections.
 */

export {
  HandshakeError,
  WebSocketError,
  ConnectionReset,
  NotConnectedError,
  InvalidMsgError,
  InvalidEventName,
  InvalidProtocolError,
  HandshakeErrorCode,
  InvalidEventNameCode,
  InvalidMsgErrorCode
} from 'colonialwars-lib/cwdtp'

/**
 * A map of all the error codes that the WSServer uses.
 */
export const ServerErrorCodes = {
  INVALID_PROTO: Symbol('kInvalidProtocol'),
  CORS_FAILED: Symbol('kCORSFailure'),
  VERIFY_FAILED: Symbol('kVerifyFailed'),
  WS_HANDSHAKE_FAILED: Symbol('kWsHandshakeFailed')
}
