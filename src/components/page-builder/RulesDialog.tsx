import type { FieldValidationRules, PageField } from '../../lib/page-builder/types'
import {
  isValidValidationPattern,
  VALIDATION_PATTERN_PRESETS,
  validationPatternExample,
  validationPatternPreset,
} from '../../lib/page-builder/validation-patterns'
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
  matchableFields,
}: {
  field: EditablePageField
  rules: FieldValidationRules
  onClose: () => void
  onClear: () => void
  onUpdate: (patch: Partial<FieldValidationRules>) => void
  numberRule: (value: string) => number | null
  matchableFields: PageField[]
}) {
  const selectedPatternPreset = validationPatternPreset(rules.customPattern)
  const patternExample = validationPatternExample(rules.customPattern)
  const patternIsInvalid = Boolean(
    rules.customPattern && !isValidValidationPattern(rules.customPattern),
  )

  function selectPatternPreset(value: string) {
    const preset = VALIDATION_PATTERN_PRESETS.find((item) => item.value === value)
    onUpdate({ customPattern: preset?.pattern ?? null })
  }

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
                <option value="custom">Regex format (configured below)</option>
              </select>
            </Field>
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

        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-[#141413]">Format and regex</h3>
          <p className="mt-1 text-xs leading-5 text-[#6c6a64]">
            Choose a common format or enter your own regular expression to test the answer.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label="Format preset">
              <select
                value={selectedPatternPreset}
                onChange={(event) => selectPatternPreset(event.target.value)}
                className={inputClass}
              >
                <option value="none">No format restriction</option>
                {VALIDATION_PATTERN_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
                {selectedPatternPreset === 'custom' && <option value="custom">Custom regex</option>}
              </select>
            </Field>
            <Field label="Regular expression">
              <input
                value={rules.customPattern ?? ''}
                onChange={(event) => onUpdate({ customPattern: event.target.value || null })}
                className={`${inputClass} font-mono`}
                placeholder="^(?:\\+63|0)9\\d{9}$"
                spellCheck={false}
                aria-invalid={patternIsInvalid || undefined}
              />
            </Field>
            {patternIsInvalid ? (
              <p role="alert" className="text-xs leading-5 text-[#c64545]">
                This regular expression is not valid. Fix it before publishing the form.
              </p>
            ) : patternExample ? (
              <p className="text-xs leading-5 text-[#6c6a64]">Accepted example: {patternExample}</p>
            ) : (
              <p className="text-xs leading-5 text-[#8e8b82]">
                Example: <code>^INV-\\d{'{4}'}$</code> accepts values such as INV-2026.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-[#141413]">Confirmation</h3>
          <p className="mt-1 text-xs leading-5 text-[#6c6a64]">
            Require this answer to exactly match an earlier field, such as confirming an email address.
          </p>
          <div className="mt-4 max-w-md">
            <Field label="Must match">
              <select
                value={rules.matchesFieldBinding ?? ''}
                onChange={(event) => onUpdate({ matchesFieldBinding: event.target.value || null })}
                className={inputClass}
                disabled={matchableFields.length === 0 && !rules.matchesFieldBinding}
              >
                <option value="">No confirmation check</option>
                {rules.matchesFieldBinding &&
                  !matchableFields.some(
                    (candidate) => candidate.bindVariable === rules.matchesFieldBinding,
                  ) && (
                    <option value={rules.matchesFieldBinding} disabled>
                      Missing field ({rules.matchesFieldBinding})
                    </option>
                  )}
                {matchableFields.map((candidate) => (
                  <option key={candidate.id} value={candidate.bindVariable}>
                    {candidate.label || 'Untitled field'} ({candidate.bindVariable})
                  </option>
                ))}
              </select>
            </Field>
            {matchableFields.length === 0 && (
              <p className="mt-2 text-xs leading-5 text-[#8e8b82]">
                Add a compatible answer field before this one to use confirmation.
              </p>
            )}
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
