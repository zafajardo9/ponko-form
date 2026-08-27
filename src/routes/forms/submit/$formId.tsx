import { createFileRoute } from '@tanstack/react-router'
import { PublicFormView } from '../../../components/public-form/PublicFormView'
import { DevSkipValidationToggle } from '../../../components/dev/DevSkipValidationToggle'

export const Route = createFileRoute('/forms/submit/$formId')({
  validateSearch: (search: Record<string, unknown>): { surveyToken?: string; rating?: string; ponkoTest?: string } => {
    const parsed: { surveyToken?: string; rating?: string; ponkoTest?: string } = {}
    if (typeof search.surveyToken === 'string') parsed.surveyToken = search.surveyToken
    if (typeof search.rating === 'string' || typeof search.rating === 'number') parsed.rating = String(search.rating)
    if (search.ponkoTest === 'wordpress-admin' || search.ponkoTest === 'popup-preview') {
      parsed.ponkoTest = search.ponkoTest
    }
    return parsed
  },
  head: () => ({
    meta: [{ name: 'referrer', content: 'no-referrer' }],
  }),
  component: PublicFormPage,
})

function PublicFormPage() {
  const { formId } = Route.useParams()
  const { surveyToken, rating, ponkoTest } = Route.useSearch()
  return (
    <>
      <PublicFormView
        publicId={formId}
        emailSurveyToken={surveyToken}
        emailSurveyRating={rating}
        testMode={Boolean(ponkoTest)}
      />
      <DevSkipValidationToggle />
    </>
  )
}
