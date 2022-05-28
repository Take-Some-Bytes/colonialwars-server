/* eslint-env jasmine */
/**
 * @fileoverview Specs for the FifoAsyncQueue class.
 */
/**
 * @typedef {import('jasmine')} jasmine
 */

const FifoAsyncQueue = require('../../lib/utils/fifo-async-queue')

/**
 * Promisified setTimeout.
 * @param {number} timeout The time to delay.
 * @returns {Promise<void>}
 */
const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout))

describe('The FifoAsyncQueue class', () => {
  it('should enforce order between queued tasks', async () => {
    const queue = new FifoAsyncQueue(1024)
    const arr = []

    queue.runTask(async () => {
      await delay(1000)
      arr.push(1)
    })
    queue.runTask(async () => {
      await delay(100)
      arr.push(2)
    })
    queue.runTask(async () => {
      await delay(10)
      arr.push(3)
    })

    await queue.allDone()

    expect(arr).toEqual([1, 2, 3])
  })

  it('should not reject all tasks if one task rejects', async () => {
    const queue = new FifoAsyncQueue(1024)
    const arr = []
    const errs = []

    queue.runTask(async () => { throw new Error() }).catch(err => errs.push(err))
    queue.runTask(async () => { arr.push(1) }).catch(err => errs.push(err))
    queue.runTask(async () => { throw new Error() }).catch(err => errs.push(err))
    queue.runTask(async () => { arr.push(2) }).catch(err => errs.push(err))
    queue.runTask(async () => { arr.push(3) }).catch(err => errs.push(err))

    await queue.allDone()

    expect(arr.length).toBe(3)
    expect(errs.length).toBe(2)
    expect(arr).toEqual([1, 2, 3])
    expect(errs.every(err => err instanceof Error)).toBeTrue()
  })

  it('should be able to limit how many tasks are queued', () => {
    const queue = new FifoAsyncQueue(1)
    let err = null
    const func = () => {
      try {
        queue.runTask(async () => { delay(100) })
      } catch (ex) { err = ex }
    }

    func()
    func()
    expect(err).toBe(null)

    func()
    func()
    expect(err).toBeInstanceOf(Error)
  })
})
