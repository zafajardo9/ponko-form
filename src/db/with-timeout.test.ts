import { describe, expect, it, vi } from 'vitest'
import { DatabaseTimeoutError, withTimeout } from './with-timeout'

describe('withTimeout', () => {
  it('resolves with the operation result', async () => {
    await expect(withTimeout(Promise.resolve('done'), 100, 'resolve')).resolves.toBe('done')
  })

  it('preserves operation failures', async () => {
    const error = new Error('query failed')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(withTimeout(Promise.reject(error), 100, 'reject')).rejects.toBe(error)
  })

  it('rejects with a labeled timeout error', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const pending = withTimeout(new Promise<never>(() => undefined), 100, 'slow query')
    const assertion = expect(pending).rejects.toEqual(new DatabaseTimeoutError('slow query', 100))

    await vi.advanceTimersByTimeAsync(100)

    await assertion
    vi.useRealTimers()
  })

  it('clears the timer after successful completion', async () => {
    vi.useFakeTimers()

    await withTimeout(Promise.resolve('done'), 100, 'cleanup')

    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
