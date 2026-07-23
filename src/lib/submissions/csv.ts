import type { ResponseColumn } from './response-columns'

export interface CsvSubmission {
  id: number
  formData: unknown
  submittedAt: Date | string | null
}

export interface CsvPayment {
  submissionId: number | null
  status: string
  amount: number
  currency: string
}

export function escapeCsvCell(value: unknown) {
  if (value == null || value === '') return ''
  const stringValue = String(value)
  const injectionSafe = /^[=+\-@]/.test(stringValue)
    ? `'${stringValue}`
    : stringValue
  return /[",\n\r]/.test(injectionSafe)
    ? `"${injectionSafe.replace(/"/g, '""')}"`
    : injectionSafe
}

export function submissionCsvHeader(columns: ResponseColumn[]) {
  return [
    '#',
    'Submitted',
    ...columns.map((column) => column.label),
    'Payment Status',
    'Payment Amount',
  ].map(escapeCsvCell).join(',')
}

function paymentStatusPriority(status: string) {
  return status === 'refunded'
    ? 4
    : status === 'completed'
      ? 3
      : status === 'pending'
        ? 2
        : 1
}

export function preferredPayments(payments: CsvPayment[]) {
  const result = new Map<number, CsvPayment>()
  for (const payment of payments) {
    if (payment.submissionId == null) continue
    const current = result.get(payment.submissionId)
    if (
      current
      && paymentStatusPriority(current.status) >= paymentStatusPriority(payment.status)
    ) {
      continue
    }
    result.set(payment.submissionId, payment)
  }
  return result
}

export function submissionCsvRow({
  submission,
  rowNumber,
  columns,
  payment,
}: {
  submission: CsvSubmission
  rowNumber: number
  columns: ResponseColumn[]
  payment?: CsvPayment
}) {
  const formData = submission.formData && typeof submission.formData === 'object'
    ? submission.formData as Record<string, unknown>
    : {}
  return [
    rowNumber,
    submission.submittedAt
      ? new Date(submission.submittedAt).toISOString()
      : '',
    ...columns.map((column) => formData[column.key]),
    payment?.status ?? '—',
    payment
      ? `${(payment.amount / 100).toFixed(2)} ${payment.currency}`
      : '—',
  ].map(escapeCsvCell).join(',')
}

export function createBatchedCsvStream({
  header,
  batchSize,
  loadBatch,
}: {
  header: string
  batchSize: number
  loadBatch: (offset: number, limit: number) => Promise<string[]>
}) {
  const encoder = new TextEncoder()
  let offset = 0
  let finished = false

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`\uFEFF${header}\r\n`))
    },
    async pull(controller) {
      if (finished) return
      try {
        const rows = await loadBatch(offset, batchSize)
        if (rows.length > 0) {
          controller.enqueue(encoder.encode(`${rows.join('\r\n')}\r\n`))
          offset += rows.length
        }
        if (rows.length < batchSize) {
          finished = true
          controller.close()
        }
      } catch (error) {
        finished = true
        controller.error(error)
      }
    },
  })
}

export function csvDownloadFilename(title: string) {
  const base = title
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'form'
  return `${base}_submissions.csv`
}

export interface SubmissionCsvSearch {
  filters?: Record<string, unknown>
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  search?: string
  archived?: boolean
}

const MAX_FILTER_QUERY_LENGTH = 20_000
const MAX_SEARCH_QUERY_LENGTH = 500
const MAX_SORT_KEY_LENGTH = 100

export function parseSubmissionCsvSearch(
  searchParams: URLSearchParams,
): SubmissionCsvSearch {
  const filtersValue = searchParams.get('filters')
  if (filtersValue && filtersValue.length > MAX_FILTER_QUERY_LENGTH) {
    throw new Error('Filters are too large')
  }

  let filters: Record<string, unknown> | undefined
  if (filtersValue) {
    const parsed = JSON.parse(filtersValue) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Filters must be an object')
    }
    filters = parsed as Record<string, unknown>
  }

  const sortKeyValue = searchParams.get('sortKey')?.trim()
  if (sortKeyValue && sortKeyValue.length > MAX_SORT_KEY_LENGTH) {
    throw new Error('Sort key is too large')
  }
  const searchValue = searchParams.get('search')?.trim()
  if (searchValue && searchValue.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new Error('Search is too large')
  }
  const sortDirValue = searchParams.get('sortDir')

  return {
    filters,
    sortKey: sortKeyValue || undefined,
    sortDir: sortDirValue === 'asc' || sortDirValue === 'desc'
      ? sortDirValue
      : undefined,
    search: searchValue || undefined,
    archived: searchParams.get('archived') === 'true',
  }
}

export function submissionCsvDownloadUrl({
  formId,
  filters,
  sortKey,
  sortDir,
  search,
  archived,
}: SubmissionCsvSearch & { formId: number | string }) {
  const params = new URLSearchParams()
  if (filters && Object.keys(filters).length > 0) {
    params.set('filters', JSON.stringify(filters))
  }
  if (sortKey) params.set('sortKey', sortKey)
  if (sortDir) params.set('sortDir', sortDir)
  if (search) params.set('search', search)
  if (archived) params.set('archived', 'true')

  const query = params.toString()
  const path = `/api/forms/${encodeURIComponent(String(formId))}/submissions-export`
  return query ? `${path}?${query}` : path
}
