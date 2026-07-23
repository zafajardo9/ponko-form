import { createFileRoute } from '@tanstack/react-router'
import { createSubmissionCsvResponse } from '../../../../lib/submissions/csv-response.server'
import { parseSubmissionCsvSearch } from '../../../../lib/submissions/csv'

export const Route = createFileRoute('/api/forms/$formId/submissions-export')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        const formId = Number(params.formId)
        if (!Number.isSafeInteger(formId) || formId <= 0) {
          return Response.json({ error: 'Invalid form ID' }, { status: 400 })
        }

        try {
          const search = parseSubmissionCsvSearch(new URL(request.url).searchParams)
          return createSubmissionCsvResponse({ formId, ...search })
        } catch {
          return Response.json({ error: 'Invalid export options' }, { status: 400 })
        }
      },
    },
  },
})
