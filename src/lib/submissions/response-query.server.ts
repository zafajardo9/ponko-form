import { db } from '../../db'
import {
  formFields,
  formPageFields,
  formPages,
  formSubmissions,
  flows,
  flowNodes,
  forms,
  profiles,
} from '../../db/schema'
import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  loadResponseColumnSources,
  responseColumnsFromSources,
  type ResponseColumn,
} from './response-columns'

const submissionStatuses = new Set([
  'pending_payment',
  'incomplete',
  'completed',
  'payment_failed',
])
const paymentStatuses = new Set(['pending', 'completed', 'failed', 'refunded'])

export const publicSubmissionSelection = {
  id: formSubmissions.id,
  formId: formSubmissions.formId,
  status: formSubmissions.status,
  formData: formSubmissions.formData,
  submittedAt: formSubmissions.submittedAt,
  archivedAt: formSubmissions.archivedAt,
}

function paymentStatusExpression() {
  return sql<string | null>`(
    SELECT p.status::text
    FROM payments p
    WHERE p.form_submission_id = ${formSubmissions.id}
    ORDER BY
      CASE p.status::text
        WHEN 'refunded' THEN 4
        WHEN 'completed' THEN 3
        WHEN 'pending' THEN 2
        ELSE 1
      END DESC,
      p.id DESC
    LIMIT 1
  )`
}

export function buildSubmissionWhereConditions({
  formId,
  archived,
  filters,
  search,
  columns,
}: {
  formId: number
  archived?: boolean
  filters?: Record<string, unknown>
  search?: string
  columns: ResponseColumn[]
}) {
  const conditions: SQL[] = [
    eq(formSubmissions.formId, formId),
    archived
      ? isNotNull(formSubmissions.archivedAt)
      : isNull(formSubmissions.archivedAt),
  ]
  const answerKeys = new Set(columns.map((column) => column.key))

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value == null || value === '') continue

    if (key === 'payment_status' && typeof value === 'string') {
      if (value === 'none') {
        conditions.push(sql`NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.form_submission_id = ${formSubmissions.id}
        )`)
      } else if (paymentStatuses.has(value)) {
        conditions.push(sql`${paymentStatusExpression()} = ${value}`)
      }
      continue
    }

    if (key === 'submitted_at' && typeof value === 'object') {
      const range = value as { from?: string; to?: string }
      const from = range.from ? new Date(`${range.from}T00:00:00`) : null
      const to = range.to ? new Date(`${range.to}T23:59:59.999`) : null
      if (from && !Number.isNaN(from.getTime())) {
        conditions.push(sql`${formSubmissions.submittedAt} >= ${from}`)
      }
      if (to && !Number.isNaN(to.getTime())) {
        conditions.push(sql`${formSubmissions.submittedAt} <= ${to}`)
      }
      continue
    }

    if (key === 'status' && typeof value === 'string') {
      if (submissionStatuses.has(value)) {
        conditions.push(sql`${formSubmissions.status}::text = ${value}`)
      }
      continue
    }

    if (answerKeys.has(key) && typeof value === 'string' && value.trim()) {
      conditions.push(
        sql`LOWER(COALESCE(${formSubmissions.formData} ->> ${key}, '')) LIKE LOWER(${'%' + value.trim() + '%'})`,
      )
    }
  }

  const normalizedSearch = search?.trim()
  if (normalizedSearch) {
    conditions.push(
      sql`LOWER(${formSubmissions.formData}::text) LIKE LOWER(${'%' + normalizedSearch + '%'})`,
    )
  }

  return conditions
}

export function buildSubmissionOrderBy({
  sortKey,
  sortDir,
  columns,
}: {
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  columns: ResponseColumn[]
}) {
  const direction = sortDir === 'asc' ? asc : desc
  const answerKeys = new Set(columns.map((column) => column.key))
  let expression: SQL | typeof formSubmissions.submittedAt =
    formSubmissions.submittedAt

  if (sortKey === 'status') {
    expression = sql`${formSubmissions.status}::text`
  } else if (sortKey === 'payment_status') {
    expression = paymentStatusExpression()
  } else if (sortKey && answerKeys.has(sortKey)) {
    expression = sql`LOWER(COALESCE(${formSubmissions.formData} ->> ${sortKey}, ''))`
  }

  return [direction(expression), desc(formSubmissions.id)] as const
}

export async function getResponseColumns(formId: number): Promise<ResponseColumn[]> {
  const sources = await loadResponseColumnSources({
    pages: () => db
      .select({
        pageId: formPages.id,
        fieldId: formPageFields.id,
        bindVariable: formPageFields.bindVariable,
        label: formPageFields.label,
      })
      .from(formPages)
      .leftJoin(formPageFields, eq(formPageFields.pageId, formPages.id))
      .where(eq(formPages.formId, formId))
      .orderBy(formPages.position, formPageFields.position, formPageFields.id),
    flows: () => db
      .select({
        flowId: flows.id,
        nodeId: flowNodes.id,
        type: flowNodes.type,
        label: flowNodes.label,
        config: flowNodes.config,
      })
      .from(flows)
      .leftJoin(flowNodes, eq(flowNodes.flowId, flows.id))
      .where(eq(flows.formId, formId))
      .orderBy(flowNodes.id),
    legacy: () => db
      .select({ id: formFields.id, label: formFields.label })
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(formFields.order),
  })

  return responseColumnsFromSources(sources)
}

export async function requireOwnedForm(formId: number, clerkId: string) {
  const [form] = await db
    .select({ form: forms })
    .from(forms)
    .innerJoin(profiles, eq(profiles.id, forms.profileId))
    .where(and(eq(forms.id, formId), eq(profiles.clerkId, clerkId)))
    .limit(1)
  if (!form) throw new Error('Not found')
  return form.form
}
