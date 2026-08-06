import type { FormPage, FormReference } from '../../lib/page-builder/types'
import type { EditablePageField } from './PageBuilderTypes'

export type EditablePage = FormPage & { fields: EditablePageField[] }

export function sortPages(pages: FormPage[]): EditablePage[] {
  return pages
    .map((page) => ({
      ...page,
      fields: [...page.fields].sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position)
}

export function sortReferences(references: FormReference[]) {
  return [...references].sort((a, b) => a.position - b.position)
}

export function snapshotBuilder(pages: EditablePage[], references: FormReference[]) {
  return JSON.stringify({
    references: references.map((reference, index) => ({
      key: reference.key,
      type: reference.type,
      value: reference.value,
      label: reference.label ?? null,
      description: reference.description ?? null,
      position: index,
    })),
    pages: pages.map((page, pageIndex) => ({
      title: page.title,
      description: page.description ?? null,
      position: pageIndex,
      isFinal: page.isFinal,
      finalTemplate: page.finalTemplate ?? null,
      finalRedirectUrl: page.finalRedirectUrl ?? null,
      finalContactEmail: page.finalContactEmail ?? null,
      hasPayment: page.hasPayment,
      paymentGatewayId: page.paymentGatewayId ?? null,
      paymentAmountVariable: page.paymentAmountVariable ?? null,
      paymentCurrency: page.paymentCurrency,
      paymentComputation: page.paymentComputation ?? null,
      subscriptionConfig: page.subscriptionConfig ?? null,
      fields: page.fields.map((field, fieldIndex) => ({
        fieldType: field.fieldType,
        label: field.label,
        placeholder: field.placeholder ?? null,
        required: field.required,
        options: field.options ?? null,
        bindVariable: field.bindVariable,
        position: fieldIndex,
        width: field.width,
        validationRules: field.validationRules ?? null,
        conditions: field.conditions.map((condition) => ({
          sourceFieldBinding: condition.sourceFieldBinding,
          operator: condition.operator,
          value: condition.value ?? null,
          action: condition.action,
        })),
      })),
    })),
  })
}
