import type { DefaultOptions } from '@tanstack/react-query'

export const QUERY_STALE_TIME_MS = 20_000
export const QUERY_GC_TIME_MS = 10 * 60_000
export const MAX_CLIENT_QUERY_RETRIES = 2

function errorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null

  const candidates = [
    'status' in error ? error.status : null,
    'statusCode' in error ? error.statusCode : null,
    'response' in error
      && error.response
      && typeof error.response === 'object'
      && 'status' in error.response
      ? error.response.status
      : null,
  ]

  for (const candidate of candidates) {
    const status = Number(candidate)
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status
  }
  return null
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= MAX_CLIENT_QUERY_RETRIES) return false
  if (error instanceof Error && error.name === 'AbortError') return false

  const status = errorStatus(error)
  if (status == null) return true
  if (status === 408 || status === 425 || status === 429) return true
  return status >= 500
}

export function queryRetryDelay(attempt: number) {
  return Math.min(500 * 2 ** Math.max(0, attempt), 4_000)
}

export function queryClientDefaults(isServer: boolean): DefaultOptions {
  return {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      gcTime: QUERY_GC_TIME_MS,
      retry: isServer ? false : shouldRetryQuery,
      retryDelay: queryRetryDelay,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  }
}
