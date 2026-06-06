import { Button } from '../../ui/Button'
import { TextField } from './controls'

/**
 * OptionsEditor
 *
 * Editor for the choices of a select / radio / checkbox field. Each option has
 * a **label** (what the respondent sees) and a **value** (what actually gets
 * stored in the bound variable when that option is chosen). The two are
 * independent: editing a label never rewrites its value, so a creator can make
 * an option read "Premium plan" but store `5000`, a SKU, a code, etc. New
 * options seed their value from the label as a convenience, after which it is
 * fully under the creator's control.
 *
 * Shared by the standalone FormField config and the Field Group's inline field
 * editor so options behave identically everywhere.
 */
export interface FieldOption {
  label: string
  value: string
}

interface OptionsEditorProps {
  options: FieldOption[]
  onChange: (next: FieldOption[]) => void
  /** Prefix for the per-input reset keys so they re-sync on selection change. */
  resetKeyPrefix: string | number
}

function slug(label: string, index: number): string {
  const s = label.toLowerCase().trim().replace(/\s+/g, '_')
  return s || `option_${index + 1}`
}

export function OptionsEditor({ options, onChange, resetKeyPrefix }: OptionsEditorProps) {
  function patch(index: number, patchObj: Partial<FieldOption>) {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patchObj } : o)))
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[#8e8b82]">
        <span className="font-medium text-[#6c6a64]">Label</span> is shown to people;{' '}
        <span className="font-medium text-[#6c6a64]">Value</span> is what gets stored in the bound
        variable.
      </p>

      {options.map((opt, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 rounded-md border border-[#e6dfd8] bg-white p-2"
        >
          <div className="flex items-center gap-1.5">
            <TextField
              resetKey={`${resetKeyPrefix}-label-${i}`}
              value={opt.label}
              onCommit={(label) => patch(i, { label })}
              placeholder="Option label"
            />
            <button
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
              className="flex-none px-1 text-sm text-[#8e8b82] hover:text-[#c64545]"
              aria-label="Remove option"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex-none text-[10px] font-medium uppercase tracking-wider text-[#8e8b82]">
              Value
            </span>
            <TextField
              resetKey={`${resetKeyPrefix}-value-${i}`}
              value={opt.value}
              onCommit={(value) => patch(i, { value })}
              placeholder="stored_value"
            />
          </div>
        </div>
      ))}

      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange([
            ...options,
            {
              label: `Option ${options.length + 1}`,
              value: slug(`Option ${options.length + 1}`, options.length),
            },
          ])
        }
      >
        + Add option
      </Button>
    </div>
  )
}
