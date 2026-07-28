import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { GroupedField } from '../../lib/flow-engine/types'
import { FieldRenderer, type FieldConfig, type FieldValue } from '../form-builder/fields/FieldRenderer'
import { Button, navigationBackIconClass } from '../ui/Button'

/**
 * GroupStepView
 *
 * Renders a Field Group step for the respondent — several fields presented
 * together on one "page" inside a grouped card, in a responsive two-column
 * grid (single column on mobile). Self-contained: it owns the per-field values
 * and validation, so callers just provide the fields and an `onSubmit` that
 * receives the collected values keyed by each field's id.
 *
 * Shared by the live runtime (FlowStepRenderer) and the builder preview
 * (FlowPreviewModal) so a group looks and behaves identically in both. Mount
 * with `key={nodeId}` so state resets when the step changes.
 */
interface GroupStepViewProps {
  title?: string
  fields: GroupedField[]
  canGoBack: boolean
  onBack: () => void
  onSubmit: (groupValues: Record<string, FieldValue>) => void
  nextLabel?: string
}

/** Fields that read better spanning the full width of the group. */
function isWide(fieldType: string): boolean {
  return fieldType === 'textarea' || fieldType === 'checkbox' || fieldType === 'radio' || fieldType === 'date' || fieldType === 'datetime'
}

export function GroupStepView({
  title,
  fields,
  canGoBack,
  onBack,
  onSubmit,
  nextLabel = 'Continue',
}: GroupStepViewProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit() {
    const errs: Record<string, string> = {}
    for (const f of fields) {
      const v = values[f.id] ?? ''
      const empty = Array.isArray(v)
        ? v.length === 0
        : v && typeof v === 'object'
          ? Object.values(v).every((item) => !String(item ?? '').trim())
          : String(v).trim() === ''
      if (f.required && empty) errs[f.id] = 'This field is required.'
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSubmit(values)
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="rounded-[var(--ponko-radius-card,16px)] border border-[#e6dfd8] bg-[#faf9f5] p-4 sm:p-5">
        {title && (
          <legend className="px-1 text-sm font-semibold text-[#141413]">{title}</legend>
        )}
        <div className="mt-1 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          {fields.map((f, i) => (
            <div key={f.id} className={isWide(f.fieldType) ? 'sm:col-span-2' : ''}>
              <FieldRenderer
                field={{
                  id: i,
                  type: (f.fieldType ?? 'text') as FieldConfig['type'],
                  label: f.label,
                  placeholder: f.placeholder,
                  required: Boolean(f.required),
                  options: f.options,
                }}
                value={values[f.id] ?? ''}
                onChange={(v) => {
                  setValues((s) => ({ ...s, [f.id]: v }))
                  setErrors((e) => ({ ...e, [f.id]: '' }))
                }}
                error={errors[f.id]}
              />
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-sm text-[#8e8b82] sm:col-span-2">
              This group has no fields yet.
            </p>
          )}
        </div>
      </fieldset>

      <div className="flex items-center justify-between">
        {canGoBack ? (
          <Button variant="navigation" size="sm" onClick={onBack}>
            <ArrowLeft size={14} className={navigationBackIconClass} />
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={submit}>{nextLabel}</Button>
      </div>
    </div>
  )
}
