import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { FlowProgressBar } from '../flow-execution/FlowProgressBar'
import {
  ACCENT_PRESETS,
  BG_PRESETS,
  DEFAULT_THEME,
  RADIUS_OPTIONS,
  isHexColor,
  themeVars,
  type FormTheme,
} from '../../lib/theme'

/**
 * SettingsDialog
 *
 * Form-level settings. Today: Appearance — accent color, background color, and
 * corner roundness — so a creator can match the respondent-facing form to their
 * brand. Colors are picked from curated presets or a custom hex/native picker,
 * with a live preview of a sample step. Saves the `theme` jsonb on the form.
 */
interface SettingsDialogProps {
  formTitle: string
  theme?: FormTheme | null
  onSave: (theme: FormTheme) => void
  onClose: () => void
}

export function SettingsDialog({ formTitle, theme, onSave, onClose }: SettingsDialogProps) {
  const [primaryColor, setPrimary] = useState(theme?.primaryColor || DEFAULT_THEME.primaryColor)
  const [backgroundColor, setBg] = useState(theme?.backgroundColor || DEFAULT_THEME.backgroundColor)
  const [radius, setRadius] = useState<NonNullable<FormTheme['radius']>>(
    theme?.radius || DEFAULT_THEME.radius,
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const draft: FormTheme = { primaryColor, backgroundColor, radius }

  function reset() {
    setPrimary(DEFAULT_THEME.primaryColor)
    setBg(DEFAULT_THEME.backgroundColor)
    setRadius(DEFAULT_THEME.radius)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-[#f5f0e8] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl border-b border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#8e8b82]">Settings —</span>
            <span className="text-sm font-medium text-[#141413]">{formTitle}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
            Appearance
          </p>

          <div className="flex flex-col gap-5">
            <ColorField label="Accent color" value={primaryColor} onChange={setPrimary} presets={ACCENT_PRESETS} />
            <ColorField label="Background" value={backgroundColor} onChange={setBg} presets={BG_PRESETS} />

            {/* Corners */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#141413]">Corners</label>
              <div className="flex rounded-lg border border-[#e6dfd8] bg-white p-0.5">
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRadius(opt.value)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      radius === opt.value
                        ? 'bg-[#cc785c] font-medium text-white'
                        : 'text-[#6c6a64] hover:text-[#141413]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#141413]">Preview</label>
              <div
                style={themeVars(draft)}
                className="rounded-[var(--ponko-radius-card,16px)] border border-[#e6dfd8] bg-[var(--ponko-bg,#faf9f5)] p-4"
              >
                <div className="flex flex-col gap-3 rounded-[var(--ponko-radius-card,16px)] border border-[#e6dfd8] bg-[var(--ponko-surface,#efe9de)] p-4">
                  <FlowProgressBar current={2} total={4} />
                  <input
                    readOnly
                    placeholder="Sample input"
                    className="w-full rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[var(--ponko-primary,#cc785c)] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)]"
                  />
                  <div className="flex items-center gap-2 rounded-[var(--ponko-radius,8px)] border border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)] px-3 py-2">
                    <input type="radio" checked readOnly className="h-4 w-4 accent-[var(--ponko-primary,#cc785c)]" />
                    <span className="text-sm text-[#141413]">Selected option</span>
                  </div>
                  <Button>Continue</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between rounded-b-xl border-t border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <Button variant="text-link" size="sm" onClick={reset}>
            Reset to default
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onSave(draft)}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A swatch row + native picker + hex field for one color. */
function ColorField({
  label,
  value,
  onChange,
  presets,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  presets: string[]
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const valid = isHexColor(text)

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#141413]">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{ backgroundColor: p }}
            className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
              value.toLowerCase() === p.toLowerCase()
                ? 'border-[#141413] ring-2 ring-[#141413]/20'
                : 'border-[#e6dfd8]'
            }`}
            aria-label={p}
            title={p}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isHexColor(value) ? value.slice(0, 7) : '#cc785c'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 flex-none cursor-pointer rounded-md border border-[#e6dfd8] bg-white p-0.5"
          aria-label={`${label} picker`}
        />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (isHexColor(e.target.value)) onChange(e.target.value)
          }}
          placeholder="#rrggbb"
          className={`h-9 w-32 rounded-md border bg-white px-3 font-mono text-sm text-[#141413] outline-none ${
            valid ? 'border-[#e6dfd8] focus:border-[#cc785c]' : 'border-[#c64545]'
          }`}
        />
      </div>
    </div>
  )
}
