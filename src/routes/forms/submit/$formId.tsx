import { createFileRoute } from '@tanstack/react-router'
import { PublicFormView } from '../../../components/public-form/PublicFormView'

export const Route = createFileRoute('/forms/submit/$formId')({
  component: PublicFormPage,
})

function PublicFormPage() {
  const { formId } = Route.useParams()
  return <PublicFormView publicId={formId} />
}
