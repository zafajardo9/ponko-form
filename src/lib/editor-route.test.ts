import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const editorSource = readFileSync(
  fileURLToPath(new URL('../routes/forms/$formId/edit.tsx', import.meta.url)),
  'utf8',
)
const ownershipSource = readFileSync(
  fileURLToPath(new URL('./server-fns/flow-helpers.ts', import.meta.url)),
  'utf8',
)
const pageFormsSource = readFileSync(
  fileURLToPath(new URL('./server-fns/page-forms.ts', import.meta.url)),
  'utf8',
)
const formsSource = readFileSync(
  fileURLToPath(new URL('./server-fns/forms.ts', import.meta.url)),
  'utf8',
)
const credentialsSource = readFileSync(
  fileURLToPath(new URL('./integrations/credentials.ts', import.meta.url)),
  'utf8',
)

function sourceSection(source: string, start: string, end: string) {
  return source.slice(source.indexOf(start), source.indexOf(end))
}

describe('editor data boundary', () => {
  it('loads one owner-scoped editor payload instead of collection and duplicate definition requests', () => {
    expect(editorSource).toContain('getEditorForm')
    expect(editorSource).toContain('queryKey: ["editor-form", formId]')
    expect(editorSource).not.toContain('getForms')
    expect(editorSource).not.toContain('getFlow(')
    expect(editorSource).not.toContain('getPageForm')
  })

  it('writes normalized page-builder saves into the editor cache without refetching', () => {
    expect(editorSource).toContain(
      'queryClient.setQueryData<EditorFormData>',
    )
    expect(editorSource).toContain('onChanged={handlePageSaved}')
    expect(editorSource).not.toContain('onChanged={() =>')
  })

  it('resolves form ownership in one joined database query', () => {
    expect(ownershipSource).toContain(
      '.innerJoin(profiles, eq(forms.profileId, profiles.id))',
    )
    expect(ownershipSource).not.toContain('const [profile]')
  })

  it('resolves flow ownership without a second form-ownership round trip', () => {
    const flowGuard = ownershipSource.slice(
      ownershipSource.indexOf('export async function assertFlowOwner'),
      ownershipSource.indexOf('/** Map a legacy/form field type'),
    )

    expect(flowGuard).toContain('.innerJoin(forms, eq(flows.formId, forms.id))')
    expect(flowGuard).toContain(
      '.innerJoin(profiles, eq(forms.profileId, profiles.id))',
    )
    expect(flowGuard).not.toContain('await assertFormOwner')
  })

  it('keeps schema migrations and duplicate form lookups out of page saves', () => {
    expect(pageFormsSource).not.toContain('ALTER TYPE "public"."field_type"')
    expect(pageFormsSource).toContain(
      'const form = await assertFormOwner(data.formId, userId)',
    )
    expect(pageFormsSource).toMatch(
      /const \[pages, references\] = await Promise\.all\(\[\s*hydratePages\(data\.formId\),\s*loadFormReferences\(data\.formId\),/,
    )
  })

  it('uses owner subqueries instead of profile round trips for form reads and writes', () => {
    const listForms = sourceSection(
      formsSource,
      'export const getForms',
      '/**\n * Load the authenticated editor',
    )
    const updateForm = sourceSection(
      formsSource,
      'export const updateForm',
      'export const deleteForm',
    )
    const deleteForm = formsSource.slice(formsSource.indexOf('export const deleteForm'))

    expect(listForms).toContain(
      '.where(inArray(forms.profileId, ownedProfileIds(userId)))',
    )
    expect(listForms).not.toContain('ensureProfile')
    expect(updateForm).toContain(
      'inArray(forms.profileId, ownedProfileIds(userId))',
    )
    expect(updateForm).not.toContain('ensureProfile')
    expect(deleteForm).toContain('.delete(forms)')
    expect(deleteForm).toContain('.returning({ id: forms.id })')
    expect(deleteForm).not.toContain('ensureProfile')
  })

  it('initializes profiles with one concurrency-safe statement', () => {
    for (const source of [formsSource, credentialsSource]) {
      const profileHelper = sourceSection(
        source,
        source.includes('export async function ensureProfile')
          ? 'export async function ensureProfile'
          : 'async function ensureProfile',
        source.includes('export async function ensureProfile')
          ? 'export async function requireProfile'
          : 'function ownedProfileIds',
      )

      expect(profileHelper).toContain('.onConflictDoUpdate({')
      expect(profileHelper).toContain('target: profiles.clerkId')
      expect(profileHelper).not.toContain('.select()')
    }
  })
})
