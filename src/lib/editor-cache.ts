import type { getEditorForm } from './server-fns/forms'
import type { SavedPageForm } from './server-fns/page-forms'

export type EditorFormData = Awaited<ReturnType<typeof getEditorForm>>

export function applySavedPageForm(
  current: EditorFormData | undefined,
  saved: SavedPageForm,
): EditorFormData | undefined {
  if (!current) return current

  const next: EditorFormData = {
    form: current.form,
    pageForm: {
      ...saved,
      form: current.form,
      references: saved.references ?? [],
      recaptchaSiteKey: current.pageForm?.recaptchaSiteKey ?? null,
    },
    flow: null,
  }
  return next
}
