export class DatabaseTimeoutError extends Error {
  readonly code = 'DB_TIMEOUT'

  constructor(
    readonly label: string,
    readonly timeoutMs: number,
  ) {
    super(`Database operation timed out: ${label} (${timeoutMs}ms)`)
    this.name = 'DatabaseTimeoutError'
  }
}

interface DatabaseOperationContext {
  formId?: number
  sessionId?: number
  pageId?: number
  correlationId?: string
  phase?: string
}

function errorCategory(error: unknown) {
  if (error instanceof DatabaseTimeoutError) return error.code
  if (error instanceof Error) return error.name || 'Error'
  return 'UnknownError'
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
  context: DatabaseOperationContext = {},
): Promise<T> {
  const startedAt = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new DatabaseTimeoutError(label, timeoutMs)), timeoutMs)
  })

  try {
    return await Promise.race([operation, timeout])
  } catch (error) {
    console.error('[database-operation-failed]', {
      operation: label,
      elapsedMs: Date.now() - startedAt,
      category: errorCategory(error),
      vercelRegion: process.env.VERCEL_REGION ?? process.env.VERCEL_REGION_ID ?? 'local',
      ...context,
    })
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
}
