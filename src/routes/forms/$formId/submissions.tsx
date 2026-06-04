import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { requireAuth } from '../../../lib/server-fns/auth'
import { getSubmissions } from '../../../lib/server-fns/submissions'

export const Route = createFileRoute('/forms/$formId/submissions')({
  beforeLoad: () => requireAuth(),
  component: SubmissionsPage,
})

function SubmissionsPage() {
  const { formId } = Route.useParams()
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['submissions', formId, page],
    queryFn: () => getSubmissions({ data: { formId: Number(formId), page } }),
  })

  const submissions = data?.submissions ?? []
  const columns = data?.columns ?? []
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
                const isExpanded = expandedId === sub.id
                const formData = sub.formData as Record<string, unknown>

                return (
                  <>
                    <tr
                      key={sub.id}
                      className="cursor-pointer transition-colors hover:bg-[#f5f0e8]"
                      onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                    >
                      <td className="px-4 py-3 text-[#8e8b82]">{(page - 1) * 50 + i + 1}</td>
                      <td className="px-4 py-3 text-[#6c6a64]">
                        {new Date(sub.submittedAt).toLocaleString()}
                      </td>
                      {previewColumns.map((c) => (
                        <td
                          key={c.key}
                          className="max-w-[200px] truncate px-4 py-3 text-[#141413]"
                        >
                          {formatValue(formData[c.key])}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-[#8e8b82]">
                        {isExpanded ? '▴' : '▾'}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${sub.id}-expanded`} className="bg-[#f5f0e8]">
                        <td colSpan={3 + previewColumns.length} className="px-6 py-4">
                          {columns.length === 0 ? (
                            <p className="text-sm text-[#8e8b82]">
                              This form has no input fields to display.
                            </p>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {columns.map((c) => (
                                <div key={c.key}>
                                  <p className="text-xs font-medium text-[#8e8b82]">{c.label}</p>
                                  <p className="mt-0.5 text-sm text-[#141413]">
                                    {formatValue(formData[c.key])}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
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
    </div>
  )
}

/** Render a stored answer value for display (joins multi-select arrays). */
function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}
