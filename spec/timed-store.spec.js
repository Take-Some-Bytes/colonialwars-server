/* eslint-env jasmine */
/**
 * @fileoverview Specs for the TimedStore class, which stores items only
 * for a set amount of time.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const TimedStore = require('../lib/timed-store')

describe('The TimedStore class,', () => {
  it('should construct without error', () => {
    let store = null
    let err = null

    try {
      store = new TimedStore({
        pruneInterval: 5000,
        maxAge: 5000,
        maxItems: 100,
        strict: true
      })
    } catch (ex) {
      err = ex
    }

    expect(err).toBe(null)
    expect(store).toBeInstanceOf(TimedStore)
    expect(store._pruneInterval.hasRef()).toBe(false)
  })

  describe('when used in strict mode', () => {
    const store = new TimedStore({
      pruneInterval: 200,
      maxAge: 100,
      maxItems: 10,
      strict: true
    })

    it("should not renew an item's TTL", done => {
      store.set('hi', 'hey there')

      setTimeout(() => {
        store.get('hi')
      }, 80)
      setTimeout(() => {
        expect(store.get('hi')).toBe(undefined)
        done()
      }, 300)
    })
  })

  describe('when used in non-strict mode', () => {
    const store = new TimedStore({
      pruneInterval: 200,
      maxAge: 290,
      maxItems: 10,
      strict: false
    })

    it("should renew an item's TTL", done => {
      store.set('hi', 'hey there')

      setTimeout(() => {
        store.get('hi')
      }, 80)
      setTimeout(() => {
        expect(store.get('hi')).toBe('hey there')
        done()
      }, 300)
    })
  })
})
