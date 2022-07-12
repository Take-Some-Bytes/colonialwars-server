/* eslint-env jasmine */
/**
 * @fileoverview Specs for the buffer utility functions that are used by
 * the CWDTP implementation.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const bufferUtils = require('../../lib/cwdtp/buffer-utils')

describe('The CWDTP buffer utility functions,', () => {
  it('should export 4 functions', () => {
    expect(Object.values(bufferUtils)).toHaveSize(4)
  })

  it('should be able to concatenate a bunch of buffers', () => {
    const bufs = [
      new Uint8Array([97, 123, 57, 100]),
      new Uint8Array([67, 52, 254, 100]),
      new Uint8Array([44, 124, 68, 102])
    ]
    const result = bufferUtils.concatBuffers(...bufs)

    expect(result).toEqual(new Uint8Array([
      97, 123, 57, 100,
      67, 52, 254, 100,
      44, 124, 68, 102
    ]))
  })

  describe('the .toBinary method,', () => {
    it('should be able to convert a string into UTF-16', () => {
      const str = 'Good morning!'
      const result = bufferUtils.toBinary(str, false)

      expect(result).toBeInstanceOf(Uint16Array)
      expect(result).toEqual(new Uint16Array(str.split('').map((_, i) => str.charCodeAt(i))))
    })
    it('should be able to convert a string into Unicode code points', () => {
      const str = 'Good morning!'
      const result = bufferUtils.toBinary(str, true)

      expect(result).toBeInstanceOf(Uint32Array)
      expect(result).toEqual(new Uint32Array([...str].map((_, i) => str.codePointAt(i))))
    })
  })

  describe('the .toString method,', () => {
    it('should be able to convert a UTF-16 array to a string', () => {
      const str = 'Good morning!'
      const buf = new Uint16Array(str.split('').map((_, i) => str.charCodeAt(i)))
      const result = bufferUtils.toString(buf, false)

      expect(result).toBeInstanceOf(String)
      expect(result).toEqual(str)
    })
    it('should be able to convert a Unicode code point array to a string', () => {
      const str = 'Good morning!'
      const buf = new Uint32Array([...str].map((_, i) => str.codePointAt(i)))
      const result = bufferUtils.toString(buf, true)

      expect(result).toBeInstanceOf(String)
      expect(result).toEqual(str)
    })
  })

  describe('the .toBase64 method,', () => {
    it('should be able to convert a buffer into base64', () => {
      const buf = Buffer.from('Good morning!')
      const result = bufferUtils.toBase64(buf)

      expect(result).toEqual(buf.toString('base64'))
    })
    it('should be able to convert a typed array into base64', () => {
      const buf = new Uint8Array([0x61, 0x62, 0x63, 0x64, 0x65, 0x66])
      const result = bufferUtils.toBase64(buf)

      expect(result).toEqual(Buffer.from(buf).toString('base64'))
    })
  })
})
