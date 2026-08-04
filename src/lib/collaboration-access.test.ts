import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(
  fileURLToPath(new URL(relative, import.meta.url)),
  'utf8',
)

describe('form collaboration access boundaries', () => {
  const helpers = source('./server-fns/flow-helpers.ts')
  const collaborators = source('./server-fns/collaborators.ts')
  const forms = source('./server-fns/forms.ts')

  it('allows owner/editor writes while explicitly rejecting viewer writes', () => {
    expect(helpers).toContain('export async function assertFormAccess')
    expect(helpers).toContain("if (access.role === 'viewer')")
    expect(helpers).toContain('export async function assertFormEditor')
    expect(helpers).toContain('export async function assertFormViewer')
    expect(helpers).toContain('export async function assertFlowEditor')
  })

  it('keeps collaborator management owner-only and audit-logs every mutation', () => {
    expect(collaborators.match(/assertFormOwner\(/g)?.length).toBeGreaterThanOrEqual(5)
    expect(collaborators).toContain("action: existing ? 'role_changed' : 'invited'")
    expect(collaborators).toContain("action: 'role_changed'")
    expect(collaborators).toContain("action: 'removed'")
  })

  it('returns owned and shared forms with an explicit access role', () => {
    expect(forms).toContain('.from(formCollaborators)')
    expect(forms).toContain("accessRole: 'owner' as const")
    expect(forms).toContain('accessRole: formCollaborators.role')
  })
})
