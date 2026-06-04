import { db } from '../../db/index'
import { flows, forms, profiles } from '../../db/schema'
import { eq } from 'drizzle-orm'
import type { FlowVariableType } from '../flow-engine/types'

/**
 * Shared ownership guards for flow server functions.
 *
 * A flow is owned by the profile that owns its parent form. Builder/editor
 * operations must verify ownership; end-user execution functions do not.
 */

/** Assert the authenticated user owns the given form. Returns the form. */
export async function assertFormOwner(formId: number, clerkId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.clerkId, clerkId))
    .limit(1)
  if (!profile) throw new Error('Unauthorized')

  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1)
  if (!form || form.profileId !== profile.id) throw new Error('Not found')
  return form
}

/** Assert the authenticated user owns the form behind the given flow. Returns the flow. */
export async function assertFlowOwner(flowId: number, clerkId: string) {
  const [flow] = await db.select().from(flows).where(eq(flows.id, flowId)).limit(1)
  if (!flow) throw new Error('Not found')
  await assertFormOwner(flow.formId, clerkId)
  return flow
}

/** Map a legacy/form field type to a flow variable type. */
export function variableTypeForField(fieldType: string): FlowVariableType {
  if (fieldType === 'number') return 'number'
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
