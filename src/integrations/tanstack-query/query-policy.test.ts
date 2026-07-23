import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import {
  MAX_CLIENT_QUERY_RETRIES,
  QUERY_GC_TIME_MS,
  QUERY_STALE_TIME_MS,
  queryClientDefaults,
  queryRetryDelay,
  shouldRetryQuery,
} from './query-policy'

describe('shared query policy', () => {
  it('keeps hydrated data briefly fresh and retains navigation cache', () => {
    const defaults = queryClientDefaults(false)

    expect(defaults.queries?.staleTime).toBe(QUERY_STALE_TIME_MS)
    expect(defaults.queries?.gcTime).toBe(QUERY_GC_TIME_MS)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true)
    expect(defaults.queries?.refetchOnReconnect).toBe(true)
    expect(defaults.mutations?.retry).toBe(false)
  })

  it('never retries queries during server rendering', () => {
    expect(queryClientDefaults(true).queries?.retry).toBe(false)
  })

  it('retries transient failures but not permanent client failures', () => {
    expect(shouldRetryQuery(0, { status: 500 })).toBe(true)
    expect(shouldRetryQuery(0, { response: { status: 429 } })).toBe(true)
    expect(shouldRetryQuery(0, new TypeError('network unavailable'))).toBe(true)

    expect(shouldRetryQuery(0, { statusCode: 401 })).toBe(false)
    expect(shouldRetryQuery(0, { status: 404 })).toBe(false)
    expect(shouldRetryQuery(0, Object.assign(new Error('cancelled'), { name: 'AbortError' })))
      .toBe(false)
    expect(shouldRetryQuery(MAX_CLIENT_QUERY_RETRIES, { status: 503 })).toBe(false)
  })

  it('bounds retry backoff', () => {
    expect(queryRetryDelay(0)).toBe(500)
    expect(queryRetryDelay(2)).toBe(2_000)
    expect(queryRetryDelay(20)).toBe(4_000)
  })

  it('reuses fresh query data across immediate remount-style fetches', async () => {
    const client = new QueryClient({
      defaultOptions: queryClientDefaults(true),
    })
    const queryFn = vi.fn().mockResolvedValue({ forms: 3 })

    await client.fetchQuery({ queryKey: ['forms'], queryFn })
    await client.fetchQuery({ queryKey: ['forms'], queryFn })

    expect(queryFn).toHaveBeenCalledOnce()
  })

  it('does not hold an SSR request open retrying a failed query', async () => {
    const client = new QueryClient({
      defaultOptions: queryClientDefaults(true),
    })
    const queryFn = vi.fn().mockRejectedValue(new Error('database unavailable'))

    await expect(client.fetchQuery({ queryKey: ['dashboard'], queryFn })).rejects
      .toThrow('database unavailable')
    expect(queryFn).toHaveBeenCalledOnce()
  })
})
