import type { FieldValidationRules } from '../../lib/page-builder/types'
import { Button } from '../ui/Button'
import { Field, FieldDialog, inputClass } from './Shared'
import type { EditablePageField } from './PageBuilderTypes'

export function RulesDialog({
  field,
  rules,
  onClose,
  onClear,
  onUpdate,
  numberRule,
}: {
  field: EditablePageField
  rules: FieldValidationRules
  onClose: () => void
  onClear: () => void
  onUpdate: (patch: Partial<FieldValidationRules>) => void
  numberRule: (value: string) => number | null
}) {
  return (
    <FieldDialog title={field.label || 'Untitled field'} subtitle="Rules" onClose={onClose}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4">
          <h3 className="mb-4 text-sm font-medium text-[#141413]">Allowed input</h3>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Allowed characters">
              <select
                value={rules.allowedCharacters ?? 'any'}
                onChange={(e) =>
                  onUpdate({
                    allowedCharacters: e.target.value as FieldValidationRules['allowedCharacters'],
                  })
                }
                className={inputClass}
              >
                <option value="any">Any</option>
                <option value="letters">Letters</option>
                <option value="numbers">Numbers</option>
                <option value="alphanumeric">Letters and numbers</option>
                <option value="custom">Custom pattern</option>
              </select>
            </Field>
            {rules.allowedCharacters === 'custom' && (
              <Field label="Pattern">
                <input
                  value={rules.customPattern ?? ''}
                  onChange={(e) => onUpdate({ customPattern: e.target.value || null })}
                  className={inputClass}
                  placeholder="^[A-Z]{3}[0-9]{4}$"
                />
              </Field>
            )}
            <Field label="Error message">
              <input
                value={rules.message ?? ''}
                onChange={(e) => onUpdate({ message: e.target.value || null })}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4">
          <h3 className="mb-4 text-sm font-medium text-[#141413]">Limits</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min length">
              <input
                type="number"
                min={0}
                value={rules.minLength ?? ''}
                onChange={(e) => onUpdate({ minLength: numberRule(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Max length">
              <input
                type="number"
                min={0}
                value={rules.maxLength ?? ''}
                onChange={(e) => onUpdate({ maxLength: numberRule(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Min value">
              <input
                type="number"
                value={rules.minValue ?? ''}
                onChange={(e) => onUpdate({ minValue: numberRule(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Max value">
              <input
                type="number"
                value={rules.maxValue ?? ''}
                onChange={(e) => onUpdate({ maxValue: numberRule(e.target.value) })}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-start">
        <Button type="button" variant="secondary" size="sm" onClick={onClear}>
          Clear Rules
        </Button>
      </div>
    </FieldDialog>
  )
}
