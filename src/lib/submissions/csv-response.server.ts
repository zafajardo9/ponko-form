import { auth } from '@clerk/tanstack-react-start/server'
import { and, inArray } from 'drizzle-orm'

import { db } from '../../db'
import { formSubmissions, payments } from '../../db/schema'
import {
  createBatchedCsvStream,
  csvDownloadFilename,
  preferredPayments,
  submissionCsvHeader,
  submissionCsvRow,
  type SubmissionCsvSearch,
} from './csv'
import {
  buildSubmissionOrderBy,
  buildSubmissionWhereConditions,
  getResponseColumns,
  publicSubmissionSelection,
  requireOwnedForm,
} from './response-query.server'

export interface SubmissionCsvExportInput extends SubmissionCsvSearch {
  formId: number
}

const CSV_EXPORT_BATCH_SIZE = 500

export async function createSubmissionCsvResponse(
  data: SubmissionCsvExportInput,
) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let form
  try {
    form = await requireOwnedForm(data.formId, userId)
  } catch {
    return Response.json({ error: 'Form not found' }, { status: 404 })
  }

  const columns = await getResponseColumns(data.formId)
  const whereConditions = buildSubmissionWhereConditions({
    formId: data.formId,
    archived: data.archived,
    filters: data.filters,
    search: data.search,
    columns,
  })
  const orderBy = buildSubmissionOrderBy({
    sortKey: data.sortKey,
    sortDir: data.sortDir,
    columns,
  })

  const stream = createBatchedCsvStream({
    header: submissionCsvHeader(columns),
    batchSize: CSV_EXPORT_BATCH_SIZE,
    loadBatch: async (offset, limit) => {
      const submissions = await db
        .select(publicSubmissionSelection)
        .from(formSubmissions)
        .where(and(...whereConditions))
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset)
      if (submissions.length === 0) return []

      const paymentRows = await db
        .select({
          submissionId: payments.formSubmissionId,
          status: payments.status,
          amount: payments.amount,
          currency: payments.currency,
        })
        .from(payments)
        .where(inArray(
          payments.formSubmissionId,
          submissions.map((submission) => submission.id),
        ))
        .groupBy(
          payments.formSubmissionId,
          payments.status,
          payments.amount,
          payments.currency,
        )
      const paymentMap = preferredPayments(paymentRows)

      return submissions.map((submission, index) =>
        submissionCsvRow({
          submission,
          rowNumber: offset + index + 1,
          columns,
          payment: paymentMap.get(submission.id),
        }),
      )
    },
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${csvDownloadFilename(form.title)}"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  })
}
