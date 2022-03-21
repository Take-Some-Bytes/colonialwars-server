/* eslint-env jasmine */
/**
 * @fileoverview Specs for the TimedStore class, which stores items only
 * for a set amount of time.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const TimedStore = require('../../lib/timed-store')

describe('The TimedStore class,', () => {
  it('should construct without error', () => {
    let store = null
    let err = null

    try {
      store = new TimedStore({
        maxAge: 5000,
        maxItems: 100,
        strict: true
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(store).toBeInstanceOf(TimedStore)
  })

  describe('when used in strict mode', () => {
    const store = new TimedStore({
      maxAge: 100,
      maxItems: 10,
      strict: true
    })

    beforeAll(() => {
      jasmine.clock().install()
    })
    afterAll(() => {
      jasmine.clock().uninstall()
    })

    it("should not renew an item's TTL", () => {
      store.set('hi', 'hey there')

      jasmine.clock().tick(80)

      // Try to renew item TTL.
      store.get('hi')

      jasmine.clock().tick(100)

      expect(store.get('hi')).toBe(undefined)
    })
  })

  describe('when used in non-strict mode', () => {
    const store = new TimedStore({
      maxAge: 100,
      maxItems: 10,
      strict: false
    })

    beforeAll(() => {
      jasmine.clock().install()
    })
    afterAll(() => {
      jasmine.clock().uninstall()
    })

    it("should renew an item's TTL", () => {
      store.set('hi', 'hey there')

      jasmine.clock().tick(80)

      // Try to renew item TTL.
      store.get('hi')

      jasmine.clock().tick(80)
      expect(store.get('hi')).toBe('hey there')
    })
  })
})
