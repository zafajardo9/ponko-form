import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index'
import { formPageFields, formPages, formReferences } from '../../db/schema'
import { isReferenceKey } from '../page-builder/references'
import type { FormReferenceType } from '../page-builder/types'
import { assertFormOwner } from './flow-helpers'

function validateReferenceValue(type: FormReferenceType, value: string) {
  if (type === 'number' && !Number.isFinite(Number(value))) {
    throw new Error('Number references need a valid numeric value')
  }
  if (type === 'percentage') {
    const parsed = Number(value.replace('%', '').trim())
    if (!Number.isFinite(parsed)) throw new Error('Percentage references need a valid percent value')
  }
  if (type === 'boolean' && !['true', 'false'].includes(value)) {
    throw new Error('Boolean references need a true or false value')
  }
}

async function fieldBindingsForForm(formId: number, excludedFieldId?: number) {
  const pages = await db.select({ id: formPages.id }).from(formPages).where(eq(formPages.formId, formId))
  if (pages.length === 0) return []
  const fields = await db
    .select({ id: formPageFields.id, bindVariable: formPageFields.bindVariable })
    .from(formPageFields)
    .where(inArray(formPageFields.pageId, pages.map((page) => page.id)))
  return fields
    .filter((field) => field.id !== excludedFieldId)
    .map((field) => field.bindVariable)
}

async function assertReferenceKeyAvailable(
  formId: number,
  key: string,
  options: { excludedReferenceId?: number; excludedFieldId?: number } = {},
) {
  if (!isReferenceKey(key)) {
    throw new Error('Reference key must use snake_case, for example service_fee')
  }

  const [existingReference] = await db
    .select({ id: formReferences.id })
    .from(formReferences)
    .where(and(eq(formReferences.formId, formId), eq(formReferences.key, key)))
    .limit(1)
  if (existingReference && existingReference.id !== options.excludedReferenceId) {
    throw new Error(`"${key}" is already used as a reference key`)
  }

  const fieldBindings = await fieldBindingsForForm(formId, options.excludedFieldId)
  if (fieldBindings.includes(key)) {
    throw new Error(`"${key}" is already used as a field binding`)
  }
}

export const getFormReferences = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    return db
      .select()
      .from(formReferences)
      .where(eq(formReferences.formId, data.formId))
      .orderBy(formReferences.position, formReferences.id)
  })

export const createFormReference = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      formId: number
      key: string
      type: FormReferenceType
      value: string
      label?: string | null
      description?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    await assertReferenceKeyAvailable(data.formId, data.key)
    validateReferenceValue(data.type, data.value)

    const existing = await db
      .select({ id: formReferences.id })
      .from(formReferences)
      .where(eq(formReferences.formId, data.formId))
    const [created] = await db
      .insert(formReferences)
      .values({
        formId: data.formId,
        key: data.key,
        type: data.type,
        value: data.value,
        label: data.label || null,
        description: data.description || null,
        position: existing.length,
      })
      .returning()
    return created
  })

export const updateFormReference = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      formId: number
      referenceId: number
      key?: string
      type?: FormReferenceType
      value?: string
      label?: string | null
      description?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const [existing] = await db
      .select()
      .from(formReferences)
      .where(and(eq(formReferences.id, data.referenceId), eq(formReferences.formId, data.formId)))
      .limit(1)
    if (!existing) throw new Error('Reference not found')

    const nextType = data.type ?? existing.type
    const nextValue = data.value ?? existing.value
    if (data.key !== undefined) {
      await assertReferenceKeyAvailable(data.formId, data.key, { excludedReferenceId: data.referenceId })
    }
    validateReferenceValue(nextType, nextValue)

    const [updated] = await db
      .update(formReferences)
      .set({
        ...(data.key !== undefined ? { key: data.key } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...(data.label !== undefined ? { label: data.label || null } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(formReferences.id, data.referenceId), eq(formReferences.formId, data.formId)))
      .returning()
    return updated
  })

export const deleteFormReference = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; referenceId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    await db
      .delete(formReferences)
      .where(and(eq(formReferences.id, data.referenceId), eq(formReferences.formId, data.formId)))
    return { success: true }
  })

export const reorderFormReferences = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; referenceIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    for (let i = 0; i < data.referenceIds.length; i++) {
      await db
        .update(formReferences)
        .set({ position: i, updatedAt: new Date() })
        .where(and(eq(formReferences.id, data.referenceIds[i]), eq(formReferences.formId, data.formId)))
    }
    return { success: true }
  })
