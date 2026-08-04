import { db } from '../../db/index'
import { flows, formCollaborators, forms, profiles } from '../../db/schema'
import { and, eq } from 'drizzle-orm'
import type { FlowVariableType } from '../flow-engine/types'

/**
 * Shared ownership guards for flow server functions.
 *
 * A flow is owned by the profile that owns its parent form. Builder/editor
 * operations must verify ownership; end-user execution functions do not.
 */

/** Assert the authenticated user owns the given form. Returns the form. */
export async function assertFormOwner(formId: number, authId: string) {
  const [owned] = await db
    .select({ form: forms })
    .from(forms)
    .innerJoin(profiles, eq(forms.profileId, profiles.id))
    .where(and(eq(forms.id, formId), eq(profiles.authId, authId)))
    .limit(1)
  if (!owned) throw new Error('Not found')
  return owned.form
}

export type FormAccessRole = 'owner' | 'editor' | 'viewer'

export async function assertFormAccess(formId: number, authId: string) {
  const [owned] = await db
    .select({ form: forms })
    .from(forms)
    .innerJoin(profiles, eq(forms.profileId, profiles.id))
    .where(and(eq(forms.id, formId), eq(profiles.authId, authId)))
    .limit(1)
  if (owned) return { form: owned.form, role: 'owner' as const }

  const [shared] = await db
    .select({ form: forms, role: formCollaborators.role })
    .from(formCollaborators)
    .innerJoin(forms, eq(formCollaborators.formId, forms.id))
    .innerJoin(profiles, eq(formCollaborators.profileId, profiles.id))
    .where(and(eq(formCollaborators.formId, formId), eq(profiles.authId, authId)))
    .limit(1)
  if (shared) return { form: shared.form, role: shared.role as FormAccessRole }
  throw new Error('Not found')
}

export async function assertFormEditor(formId: number, authId: string) {
  const access = await assertFormAccess(formId, authId)
  if (access.role === 'viewer') {
    throw new Error('You can view this form but not edit it')
  }
  return access.form
}

export async function assertFormViewer(formId: number, authId: string) {
  return (await assertFormAccess(formId, authId)).form
}

/** Assert the authenticated user owns the form behind the given flow. Returns the flow. */
export async function assertFlowOwner(flowId: number, authId: string) {
  const [owned] = await db
    .select({ flow: flows })
    .from(flows)
    .innerJoin(forms, eq(flows.formId, forms.id))
    .innerJoin(profiles, eq(forms.profileId, profiles.id))
    .where(and(eq(flows.id, flowId), eq(profiles.authId, authId)))
    .limit(1)
  if (!owned) throw new Error('Not found')
  return owned.flow
}

export async function assertFlowEditor(flowId: number, authId: string) {
  const [flow] = await db
    .select({ flow: flows, formId: flows.formId })
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1)
  if (!flow) throw new Error('Not found')
  await assertFormEditor(flow.formId, authId)
  return flow.flow
}

/** Map a legacy/form field type to a flow variable type. */
export function variableTypeForField(fieldType: string): FlowVariableType {
  if (fieldType === 'number') return 'number'
  if (fieldType === 'date') return 'date'
  if (fieldType === 'time') return 'time'
  if (fieldType === 'datetime') return 'datetime'
  return 'string'
}

/** Build a unique snake_case variable name from a label. Mutates `used`. */
export function uniqueVarName(label: string, used: Set<string>, fallback: string): string {
  let base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!base || !/^[a-z]/.test(base)) base = fallback
  let name = base
  let i = 2
  while (used.has(name)) name = `${base}_${i++}`
  used.add(name)
  return name
}
