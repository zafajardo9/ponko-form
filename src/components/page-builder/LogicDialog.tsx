import type {
  ConditionAction,
  ConditionOperator,
  FieldCondition,
  FormReference,
  PageField,
} from '../../lib/page-builder/types'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Field, FieldDialog, inputClass } from './Shared'
import type { EditablePageField } from './PageBuilderTypes'

export function LogicDialog({
  field,
  fields,
  references,
  conditions,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: {
  field: EditablePageField
  fields: PageField[]
  references: FormReference[]
  conditions: FieldCondition[]
  onClose: () => void
  onAdd: () => void
  onUpdate: (index: number, patch: Partial<FieldCondition>) => void
  onRemove: (index: number) => void
}) {
  return (
    <FieldDialog title={field.label || 'Untitled field'} subtitle="Logic" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[#6c6a64]">
          Multiple logic rules use AND matching.
        </p>
        <Button type="button" size="sm" onClick={onAdd}>
          Add Rule
        </Button>
      </div>

      {conditions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e6dfd8] bg-[#faf9f5] p-8 text-center text-sm text-[#8e8b82]">
          No logic rules yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {conditions.map((condition, index) => {
            const sourceField = fields.find((item) => item.bindVariable === condition.sourceFieldBinding)
            const sourceOptions = ['select', 'checkbox', 'radio', 'satisfaction'].includes(sourceField?.fieldType ?? '')
              ? sourceField?.options ?? []
              : []
            const valueDisabled = ['is_empty', 'is_not_empty'].includes(condition.operator)
            return (
              <div key={condition.id} className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_1fr_160px_auto] md:items-end">
                  <Field label="When field">
                    <select
                      value={condition.sourceFieldBinding}
                      onChange={(e) => onUpdate(index, { sourceFieldBinding: e.target.value, value: '' })}
                      className={inputClass}
                    >
                      <option value="">Choose field...</option>
                      {fields.filter((item) => item.id !== field.id && item.fieldType !== 'recaptcha').map((item) => (
                        <option key={item.id} value={item.bindVariable}>
                          {item.label || item.bindVariable}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Operator">
                    <select
                      value={condition.operator}
                      onChange={(e) => onUpdate(index, { operator: e.target.value as ConditionOperator })}
                      className={inputClass}
                    >
                      {['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'].map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Value">
                    {sourceOptions.length > 0 && !valueDisabled ? (
                      <select
                        value={condition.value ?? ''}
                        onChange={(e) => onUpdate(index, { value: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Choose option...</option>
                        {sourceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <input
                          value={condition.value ?? ''}
                          onChange={(e) => onUpdate(index, { value: e.target.value })}
                          disabled={valueDisabled}
                          className={inputClass}
                        />
                        {!valueDisabled && references.length > 0 && (
                          <select
                            value={(condition.value ?? '').match(/^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/)?.[1] ?? ''}
                            onChange={(e) => onUpdate(index, { value: e.target.value ? `{{${e.target.value}}}` : '' })}
                            className={inputClass}
                          >
                            <option value="">Use reference...</option>
                            {references.map((reference) => (
                              <option key={reference.id} value={reference.key}>
                                {reference.label || reference.key} = {reference.value}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </Field>
                  <Field label="Then">
                    <select
                      value={condition.action}
                      onChange={(e) => onUpdate(index, { action: e.target.value as ConditionAction })}
                      className={inputClass}
                    >
                      <option value="show">Show field</option>
                      <option value="hide">Hide field</option>
                    </select>
                  </Field>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="inline-flex h-10 items-center justify-center gap-1 rounded-md px-3 text-sm text-[#c64545] hover:bg-[#fff3ef]"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </FieldDialog>
  )
}
