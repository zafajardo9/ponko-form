import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { formFields, forms, profiles } from '../../db/schema'
import { eq, max } from 'drizzle-orm'

async function assertFormOwner(formId: number, clerkId: string) {
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

export const getFields = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    return db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, data.formId))
      .orderBy(formFields.order)
  })

export const addField = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      formId: number
      type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'payment'
      label: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const [maxOrderRow] = await db
      .select({ maxOrder: max(formFields.order) })
      .from(formFields)
      .where(eq(formFields.formId, data.formId))

    const nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1

    const [field] = await db
      .insert(formFields)
      .values({
        formId: data.formId,
        type: data.type,
        label: data.label,
        order: nextOrder,
      })
      .returning()
    return field
  })

export const updateField = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      fieldId: number
      formId: number
      label?: string
      placeholder?: string
      required?: boolean
      options?: { label: string; value: string }[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const { fieldId, formId: _formId, ...fields } = data
    const [field] = await db
      .update(formFields)
      .set(fields)
      .where(eq(formFields.id, fieldId))
      .returning()
    return field
  })

export const deleteField = createServerFn({ method: 'POST' })
  .inputValidator((data: { fieldId: number; formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    await db.delete(formFields).where(eq(formFields.id, data.fieldId))
    return { success: true }
  })

export const reorderFields = createServerFn({ method: 'POST' })
  .inputValidator((data: { formId: number; orderedIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    await Promise.all(
      data.orderedIds.map((id: number, index: number) =>
        db.update(formFields).set({ order: index }).where(eq(formFields.id, id)),
      ),
    )
    return { success: true }
  })
