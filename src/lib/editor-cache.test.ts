import { describe, expect, it } from 'vitest'
import {
  applySavedPageForm,
  type EditorFormData,
} from './editor-cache'
import type { SavedPageForm } from './server-fns/page-forms'

describe('applySavedPageForm', () => {
  it('replaces the saved definition while preserving editor-only metadata', () => {
    const form = {
      id: 42,
      title: 'Registration',
      theme: { primaryColor: '#cc785c' },
    }
    const oldPages = [{ id: 1, title: 'Old page' }]
    const savedPages = [{ id: 2, title: 'Normalized page' }]
    const savedReferences = [{ id: 7, key: 'fee', value: '25' }]
    const current = {
      form,
      pageForm: {
        form,
        pages: oldPages,
        references: [],
        recaptchaSiteKey: 'site-key',
      },
      flow: null,
    } as unknown as EditorFormData
    const saved = {
      form,
      pages: savedPages,
      references: savedReferences,
    } as unknown as SavedPageForm

    const next = applySavedPageForm(current, saved)

    expect(next?.form).toBe(current.form)
    expect(next?.pageForm?.pages).toBe(saved.pages)
    expect(next?.pageForm?.references).toBe(saved.references)
    expect(next?.pageForm?.recaptchaSiteKey).toBe('site-key')
    expect(next?.flow).toBeNull()
  })

  it('does not create cache state after the editor has been removed', () => {
    expect(
      applySavedPageForm(undefined, {} as SavedPageForm),
    ).toBeUndefined()
  })
})
