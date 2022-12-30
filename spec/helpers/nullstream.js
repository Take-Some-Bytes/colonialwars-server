/* eslint-env node */
/**
 * @fileoverview Writing to nothing.
 */

import stream from 'stream'

/**
 * Creates a writable stream which writes to nowhere.
 * @returns {fs.WriteStream}
 */
export default function createNullStream () {
  return new stream.Writable({
    write (_, __, cb) {
      setImmediate(cb)
    }
  })
}
