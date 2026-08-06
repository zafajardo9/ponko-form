import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  fieldConditions,
  formPageFields,
  formPages,
  formReferences,
} from '../../db/schema'
import type {
  FieldCondition,
  FieldValidationRules,
  FormPage,
  PageField,
  PageFieldType,
  PaymentComputation,
  SubscriptionConfig,
} from './types'

export async function hydratePages(formId: number): Promise<FormPage[]> {
  const pages = await db
    .select()
    .from(formPages)
    .where(eq(formPages.formId, formId))
    .orderBy(formPages.position, formPages.id)
  if (pages.length === 0) return []

  const pageIds = pages.map((page) => page.id)
  const fields = await db
    .select()
    .from(formPageFields)
    .where(inArray(formPageFields.pageId, pageIds))
    .orderBy(formPageFields.position, formPageFields.id)
  const fieldIds = fields.map((field) => field.id)
  const conditions = fieldIds.length > 0
    ? await db
        .select()
        .from(fieldConditions)
        .where(inArray(fieldConditions.fieldId, fieldIds))
        .orderBy(fieldConditions.id)
    : []

  const conditionsByField = new Map<number, FieldCondition[]>()
  for (const condition of conditions) {
    conditionsByField.set(condition.fieldId, [
      ...(conditionsByField.get(condition.fieldId) ?? []),
      condition as FieldCondition,
    ])
  }

  const fieldsByPage = new Map<number, PageField[]>()
  for (const field of fields) {
    fieldsByPage.set(field.pageId, [
      ...(fieldsByPage.get(field.pageId) ?? []),
      {
        id: field.id,
        pageId: field.pageId,
        fieldType: field.fieldType as PageFieldType,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
        options: field.options ?? null,
        bindVariable: field.bindVariable,
        position: field.position,
        width: field.width,
        validationRules: (field.validationRules as FieldValidationRules | null) ?? null,
        conditions: conditionsByField.get(field.id) ?? [],
      },
    ])
  }

  return pages.map((page) => ({
    id: page.id,
    formId: page.formId,
    title: page.title,
    description: page.description,
    position: page.position,
    isFinal: page.isFinal,
    finalTemplate: page.finalTemplate,
    finalRedirectUrl: page.finalRedirectUrl,
    finalContactEmail: page.finalContactEmail,
    hasPayment: page.hasPayment,
    paymentGatewayId: page.paymentGatewayId,
    paymentAmountVariable: page.paymentAmountVariable,
    paymentCurrency: page.paymentCurrency,
    paymentComputation: (page.paymentComputation as PaymentComputation | null) ?? null,
    subscriptionConfig: (page.subscriptionConfig as SubscriptionConfig | null) ?? null,
    fields: fieldsByPage.get(page.id) ?? [],
  }))
}

export async function loadFormReferences(formId: number) {
  return db
    .select()
    .from(formReferences)
    .where(eq(formReferences.formId, formId))
    .orderBy(formReferences.position, formReferences.id)
}
