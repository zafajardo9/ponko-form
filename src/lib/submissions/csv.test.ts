import { describe, expect, it, vi } from 'vitest'

import {
  createBatchedCsvStream,
  csvDownloadFilename,
  escapeCsvCell,
  parseSubmissionCsvSearch,
  preferredPayments,
  submissionCsvDownloadUrl,
  submissionCsvHeader,
  submissionCsvRow,
} from './csv'

describe('submission CSV streaming', () => {
  it('escapes delimiters and neutralizes spreadsheet formulas', () => {
    expect(escapeCsvCell('hello, "world"')).toBe('"hello, ""world"""')
    expect(escapeCsvCell('=IMPORTXML("https://example.com")'))
      .toBe('"\'=IMPORTXML(""https://example.com"")"')
    expect(submissionCsvHeader([{ key: 'company', label: 'Company, legal name' }]))
      .toContain('"Company, legal name"')
  })

  it('selects the highest-priority payment and serializes safe rows', () => {
    const paymentMap = preferredPayments([
      { submissionId: 7, status: 'failed', amount: 100, currency: 'USD' },
      { submissionId: 7, status: 'completed', amount: 100, currency: 'USD' },
    ])

    expect(submissionCsvRow({
      submission: {
        id: 7,
        formData: { company: '+Dangerous Ltd' },
        submittedAt: '2026-07-23T00:00:00.000Z',
      },
      rowNumber: 1,
      columns: [{ key: 'company', label: 'Company' }],
      payment: paymentMap.get(7),
    })).toBe("1,2026-07-23T00:00:00.000Z,'+Dangerous Ltd,completed,1.00 USD")
  })

  it('loads and emits bounded batches until the final partial batch', async () => {
    const loadBatch = vi.fn(async (offset: number, limit: number) =>
      offset === 0
        ? Array.from({ length: limit }, (_, index) => `row-${index + 1}`)
        : ['row-3'],
    )
    const response = new Response(createBatchedCsvStream({
      header: 'Header',
      batchSize: 2,
      loadBatch,
    }))

    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toBe(
      'Header\r\nrow-1\r\nrow-2\r\nrow-3\r\n',
    )
    expect(loadBatch.mock.calls).toEqual([[0, 2], [2, 2]])
  })

  it('creates header-safe compact filenames', () => {
    expect(csvDownloadFilename('Customer / Intake\r\n2026'))
      .toBe('Customer-Intake-2026_submissions.csv')
  })

  it('round-trips the download URL search state', () => {
    const url = submissionCsvDownloadUrl({
      formId: 42,
      filters: { status: ['completed'], name: 'Ada & Co' },
      sortKey: 'submitted_at',
      sortDir: 'desc',
      search: 'paid',
      archived: true,
    })
    const parsedUrl = new URL(url, 'https://example.test')

    expect(parsedUrl.pathname).toBe('/api/forms/42/submissions-export')
    expect(parseSubmissionCsvSearch(parsedUrl.searchParams)).toEqual({
      filters: { status: ['completed'], name: 'Ada & Co' },
      sortKey: 'submitted_at',
      sortDir: 'desc',
      search: 'paid',
      archived: true,
    })
  })

  it('rejects malformed and oversized export searches', () => {
    expect(() => parseSubmissionCsvSearch(new URLSearchParams({
      filters: '[]',
    }))).toThrow('Filters must be an object')
    expect(() => parseSubmissionCsvSearch(new URLSearchParams({
      filters: '{',
    }))).toThrow()
    expect(() => parseSubmissionCsvSearch(new URLSearchParams({
      search: 'x'.repeat(501),
    }))).toThrow('Search is too large')
  })
})
