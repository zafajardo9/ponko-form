import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    'utf8',
  )
}

describe('submission server boundaries', () => {
  it('keeps the streaming response out of the client-imported RPC module', () => {
    const rpcModule = source('../server-fns/submissions.ts')
    const exportRoute = source('../../routes/api/forms/$formId/submissions-export.ts')
    const streamingModule = source('./csv-response.server.ts')

    expect(rpcModule).not.toContain('createSubmissionCsvResponse')
    expect(exportRoute).toContain(
      "from '../../../../lib/submissions/csv-response.server'",
    )
    expect(streamingModule).toContain('createSubmissionCsvResponse')
    expect(streamingModule).toContain('CSV_EXPORT_BATCH_SIZE = 500')
  })
})
