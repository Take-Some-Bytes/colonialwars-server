/* eslint-env node */
/**
 * @fileoverview A FIFO queue for executing async tasks in sequence, letting subsequent
 * tasks execute only after the one before it has completed.
 */

/**
 * @typedef {Object} Task
 * @prop {() => Promise<any>} task
 * @prop {(value: any | PromiseLike<any>) => void} resolve
 * @prop {(reason: any) => void} reject
 *
 * @typedef {Object} Waiter
 * @prop {(value: void | PromiseLike<void>) => void} resolve
 */

/**
 * FifoAsyncQueue class.
 *
 * A FIFO queue for executing async tasks in sequence, letting subsequent
 * tasks execute only after the one before it has completed.
 */
class FifoAsyncQueue {
  /**
   * Create a new FifoAsyncQueue.
   *
   * A FifoAsyncQueue object executes tasks in sequence, letting subsequent
   * tasks execute only after the one before it has completed.
   *
   * @param {number} max The maximum amount of async tasks that can be queued at any time.
   */
  constructor (max) {
    this.max = max

    /**
     * An array of all pending tasks.
     * @type {Array<Task>}
     * @private
     */
    this._tasks = []
    /**
     * An array of all promises waiting for all tasks to be completed.
     * @type {Array<Waiter>}
     * @private
     */
    this._waiters = []
    /** @private */
    this._busy = false
  }

  /**
   * Runs a single queued task.
   * @param {Task} taskObj The task to run.
   * @private
   */
  _execute (taskObj) {
    const { task, resolve, reject } = taskObj

    task().then(resolve, reject).then(this._dequeue.bind(this))
  }

  /**
   * Attempts to run all the tasks currently queued.
   * @private
   */
  _dequeue () {
    this._busy = true

    const next = this._tasks.shift()
    if (next) {
      this._execute(next)
    } else {
      this._resolveWaiters()
      this._busy = false
    }
  }

  /**
   * Resolve all waiters.
   * @private
   */
  _resolveWaiters () {
    const waiters = this._waiters.splice(0)
    waiters.forEach(({ resolve }) => resolve())
  }

  /**
   * Pushes an async task onto the queue to be executed.
   * @param {() => Promise<T>} task The task to run.
   * @returns {Promise<T>}
   * @template T
   */
  runTask (task) {
    if (this._tasks.length + 1 > this.max) {
      throw new Error('Too many tasks queued!')
    }

    return new Promise((resolve, reject) => {
      this._tasks.push({ task, resolve, reject })
      if (!this._busy) {
        this._dequeue()
      }
    })
  }

  /**
   * Waits until all the tasks in this FifoAsyncQueue have been processed.
   *
   * **NOTE**: As tasks can be added while they're being processed, it is entirely
   * possible that the queue won't be cleared for an extended amount of time.
   * Therefore, one should use this method with caution.
   * @returns {Promise<void>}
   */
  allDone () {
    return new Promise(resolve => {
      this._waiters.push({ resolve })

      if (!this._busy && this._tasks.length === 0) {
        this._resolveWaiters()
      }
    })
  }
}

module.exports = FifoAsyncQueue
