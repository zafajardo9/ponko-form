import { createFileRoute } from '@tanstack/react-router'
import { PublicFormView } from '../../../components/public-form/PublicFormView'

export const Route = createFileRoute('/forms/submit/$formId')({
  validateSearch: (search: Record<string, unknown>): { surveyToken?: string; rating?: string } => {
    const parsed: { surveyToken?: string; rating?: string } = {}
    if (typeof search.surveyToken === 'string') parsed.surveyToken = search.surveyToken
    if (typeof search.rating === 'string' || typeof search.rating === 'number') parsed.rating = String(search.rating)
    return parsed
  },
  head: () => ({
    meta: [{ name: 'referrer', content: 'no-referrer' }],
  }),
  component: PublicFormPage,
})

function PublicFormPage() {
  const { formId } = Route.useParams()
  const { surveyToken, rating } = Route.useSearch()
  return <PublicFormView publicId={formId} emailSurveyToken={surveyToken} emailSurveyRating={rating} />
}
