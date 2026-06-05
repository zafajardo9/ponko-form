import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { requireAuth } from '../../../lib/server-fns/auth'
import { getSubmissions } from '../../../lib/server-fns/submissions'

export const Route = createFileRoute('/forms/$formId/submissions')({
  beforeLoad: () => requireAuth(),
  component: SubmissionsPage,
})

interface Column {
  key: string
  label: string
}

function SubmissionsPage() {
  const { formId } = Route.useParams()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<{ sub: any; number: number } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', formId, page],
    queryFn: () => getSubmissions({ data: { formId: Number(formId), page } }),
  })

  const submissions = data?.submissions ?? []
  const columns = (data?.columns ?? []) as Column[]
  const form = data?.form
  const previewColumns = columns.slice(0, 3)

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-[#6c6a64]">
            <Link to="/dashboard" className="hover:text-[#141413]">Dashboard</Link>
            <span>/</span>
            <Link to="/forms/$formId/edit" params={{ formId }} className="hover:text-[#141413]">
              {form?.title ?? 'Form'}
            </Link>
            <span>/</span>
            <span className="text-[#141413]">Responses</span>
          </div>
          <h1 className="text-2xl font-medium text-[#141413]">
            Responses
            {submissions.length > 0 && (
              <span className="ml-2 text-base text-[#6c6a64]">({submissions.length})</span>
            )}
          </h1>
        </div>
        <Link to="/forms/$formId/edit" params={{ formId }}>
          <span className="text-sm text-[#cc785c] hover:text-[#a9583e]">← Back to builder</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-[#efe9de]" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e6dfd8] py-24 text-center">
          <p className="text-[#8e8b82]">No responses yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e6dfd8]">
          <table className="w-full text-sm">
            <thead className="border-b border-[#e6dfd8] bg-[#f5f0e8]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">#</th>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">Submitted</th>
                {previewColumns.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6dfd8] bg-[#faf9f5]">
              {submissions.map((sub: any, i: number) => {
                const number = (page - 1) * 50 + i + 1
                const formData = sub.formData as Record<string, unknown>

                return (
                  <tr
                    key={sub.id}
                    className="cursor-pointer transition-colors hover:bg-[#f5f0e8]"
                    onClick={() => setSelected({ sub, number })}
                  >
                    <td className="px-4 py-3 text-[#8e8b82]">{number}</td>
                    <td className="px-4 py-3 text-[#6c6a64]">
                      {new Date(sub.submittedAt).toLocaleString()}
                    </td>
                    {previewColumns.map((c) => (
                      <td key={c.key} className="max-w-[200px] truncate px-4 py-3 text-[#141413]">
                        {formatValue(formData[c.key])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-[#cc785c]">
                      View →
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {submissions.length === 50 && (
            <div className="flex justify-center gap-3 border-t border-[#e6dfd8] py-3">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-sm text-[#cc785c] disabled:opacity-40 hover:text-[#a9583e]"
              >
                ← Previous
              </button>
              <span className="text-sm text-[#6c6a64]">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="text-sm text-[#cc785c] hover:text-[#a9583e]"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {selected && (
        <ResponseDialog
          number={selected.number}
          submission={selected.sub}
          columns={columns}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function ResponseDialog({
  number,
  submission,
  columns,
  onClose,
}: {
  number: number
  submission: any
  columns: Column[]
  onClose: () => void
}) {
  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const formData = (submission.formData as Record<string, unknown>) ?? {}
  const paymentRef = formData.payment_ref as string | undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-[#faf9f5] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#141413]">Response #{number}</h2>
            <p className="mt-0.5 text-xs text-[#8e8b82]">
              Submitted {new Date(submission.submittedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8e8b82] transition-colors hover:bg-[#e8e0d2] hover:text-[#141413]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {columns.length === 0 ? (
            <p className="text-sm text-[#8e8b82]">This form has no input fields to display.</p>
          ) : (
            <dl className="divide-y divide-[#e6dfd8] rounded-lg border border-[#e6dfd8] bg-white">
              {columns.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                >
                  <dt className="text-sm font-medium text-[#6c6a64] sm:w-1/3 sm:shrink-0">
                    {c.label}
                  </dt>
                  <dd className="whitespace-pre-wrap break-words text-sm text-[#141413] sm:flex-1 sm:text-right">
                    {formatValue(formData[c.key])}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {paymentRef && (
            <p className="mt-4 text-xs text-[#8e8b82]">
              Payment reference: <span className="font-mono text-[#57544d]">{paymentRef}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Render a stored answer value for display (joins multi-select arrays). */
function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}
