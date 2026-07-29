import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
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
 * Form-level settings with a modern, polished UI. Covers form naming and
 * respondent-facing appearance — accent color, background, and corner roundness.
 * Curated presets + custom hex picker + a live preview that reacts in real time.
 */
interface SettingsDialogProps {
  formTitle: string
  theme?: FormTheme | null
  onSave: (settings: { title: string; theme: FormTheme }) => void
  onClose: () => void
  saveError?: string | null
}

export function SettingsDialog({ formTitle, theme, onSave, onClose, saveError }: SettingsDialogProps) {
  const [title, setTitle] = useState(formTitle)
  const [titleError, setTitleError] = useState('')
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

  function save() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('Form name is required')
      return
    }
    onSave({ title: trimmedTitle, theme: draft })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8] bg-[#faf9f5] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-sm font-semibold text-[#141413]">Form settings</span>
            <span className="text-xs text-[#8e8b82]">· {formTitle}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8b82] transition-colors hover:bg-[#efe9de] hover:text-[#141413]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Form name */}
          <div className="mb-6 flex flex-col gap-1.5">
            <label htmlFor="form-name" className="text-sm font-medium text-[#141413]">
              Form name
            </label>
            <input
              id="form-name"
              value={title}
              maxLength={255}
              onChange={(e) => {
                setTitle(e.target.value)
                if (titleError) setTitleError('')
              }}
              className={`h-10 rounded-lg border bg-white px-3.5 text-sm text-[#141413] outline-none transition-colors placeholder:text-[#8e8b82] focus:ring-2 ${
                titleError
                  ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/15'
                  : 'border-[#e6dfd8] focus:border-[#cc785c] focus:ring-[#cc785c]/15'
              }`}
              placeholder="e.g. Customer feedback survey"
            />
            {titleError && <p className="text-xs text-[#c64545]">{titleError}</p>}
          </div>

          {/* Appearance section */}
          <div className="mb-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-[#e6dfd8]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
              Appearance
            </span>
            <div className="h-px flex-1 bg-[#e6dfd8]" />
          </div>

          <div className="flex flex-col gap-6">
            <ColorField label="Accent color" value={primaryColor} onChange={setPrimary} presets={ACCENT_PRESETS} />
            <ColorField label="Background" value={backgroundColor} onChange={setBg} presets={BG_PRESETS} />

            {/* Corners */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#141413]">Corner radius</label>
              <div className="flex gap-2">
                {RADIUS_OPTIONS.map((opt) => {
                  const isActive = radius === opt.value
                  const previewRadius = opt.value === 'sharp' ? 'rounded-sm' : opt.value === 'rounded' ? 'rounded-lg' : 'rounded-full'
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setRadius(opt.value)}
                      className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                        isActive
                          ? 'border-[#cc785c] bg-[#cc785c]/5 ring-1 ring-[#cc785c]/20'
                          : 'border-[#e6dfd8] bg-white hover:border-[#c9b4a8] hover:bg-[#faf9f5]'
                      }`}
                    >
                      <div className={`h-5 w-12 border border-current ${previewRadius} ${
                        isActive ? 'border-[#cc785c] bg-[#cc785c]/20' : 'border-[#6c6a64] bg-[#e6dfd8]'
                      }`} />
                      <span className={`text-xs font-medium ${
                        isActive ? 'text-[#cc785c]' : 'text-[#6c6a64]'
                      }`}>
                        {opt.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Live preview */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#141413]">Live preview</label>
              <div
                style={themeVars(draft)}
                className="overflow-hidden rounded-xl border border-[#e6dfd8] bg-gradient-to-b from-[var(--ponko-bg,#faf9f5)] to-[var(--ponko-bg,#faf9f5)] shadow-sm"
              >
                <div
                  className="m-3 flex flex-col gap-3 rounded-xl border border-[#e6dfd8] bg-[var(--ponko-surface,#efe9de)] p-4"
                  style={{ borderRadius: 'var(--ponko-radius-card, 16px)' }}
                >
                  <FlowProgressBar current={2} total={4} />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6c6a64]">What's your name?</span>
                    </div>
                    <input
                      readOnly
                      placeholder="Type your answer..."
                      className="w-full rounded-[var(--ponko-radius,8px)] border border-[#e6dfd8] bg-white px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none transition-colors focus:border-[var(--ponko-primary,#cc785c)] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[#6c6a64]">Choose an option</span>
                    {['First choice', 'Second choice'].map((label, i) => (
                      <label
                        key={label}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-[var(--ponko-radius,8px)] px-3 py-2.5 transition-colors ${
                          i === 0
                            ? 'border border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)]'
                            : 'border border-[#e6dfd8] bg-white hover:bg-[#faf9f5]'
                        }`}
                      >
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                          i === 0 ? 'border-[var(--ponko-primary,#cc785c)]' : 'border-[#c9b4a8]'
                        }`}>
                          {i === 0 && (
                            <div className="h-2 w-2 rounded-full bg-[var(--ponko-primary,#cc785c)]" />
                          )}
                        </div>
                        <span className="text-sm text-[#141413]">{label}</span>
                      </label>
                    ))}
                  </div>
                  <Button size="sm">Continue</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col border-t border-[#e6dfd8] bg-[#faf9f5]">
          {saveError && (
            <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg bg-[#c64545]/8 px-3 py-2">
              <span className="mt-0.5 shrink-0 text-xs">⚠</span>
              <p className="text-xs text-[#c64545]">{saveError}</p>
            </div>
          )}
          <div className="flex items-center justify-between px-6 py-4">
            <Button variant="text-link" size="sm" onClick={reset}>
              Reset to default
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={save}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Color field: curated swatches + native picker + hex text input. */
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
    <div className="flex flex-col gap-2.5">
      <label className="text-sm font-medium text-[#141413]">{label}</label>

      {/* Swatches */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const isSelected = value.toLowerCase() === p.toLowerCase()
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              style={{ backgroundColor: p }}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all hover:scale-110 ${
                isSelected
                  ? 'border-[#141413] shadow-[0_0_0_2px_rgba(20,20,19,0.12)] scale-110'
                  : 'border-transparent hover:border-[#c9b4a8]'
              }`}
              aria-label={p}
              title={p}
            >
              {isSelected && (
                <Check
                  size={16}
                  className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                  style={{ color: isLightColor(p) ? '#141413' : '#ffffff' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={isHexColor(value) ? value.slice(0, 7) : '#cc785c'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
            aria-label={`${label} picker`}
          />
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#e6dfd8] bg-white shadow-sm transition-colors hover:border-[#c9b4a8]"
            style={{ backgroundColor: isHexColor(value) ? value : '#cc785c' }}
          >
            <span className="text-lg leading-none mix-blend-difference invert">🎨</span>
          </div>
        </div>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (isHexColor(e.target.value)) onChange(e.target.value)
          }}
          placeholder="#rrggbb"
          className={`h-10 w-36 rounded-lg border bg-white px-3 font-mono text-sm text-[#141413] outline-none transition-colors placeholder:text-[#8e8b82] focus:ring-2 ${
            valid
              ? 'border-[#e6dfd8] focus:border-[#cc785c] focus:ring-[#cc785c]/15'
              : 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/15'
          }`}
        />
        {text !== value && valid && (
          <span className="text-xs text-[#8e8b82]">
            Press Enter
          </span>
        )}
      </div>
    </div>
  )
}

/** Whether a hex color is "light" enough to need dark text/icons on top. */
function isLightColor(hex: string): boolean {
  const h = hex.replace(/^#/, '')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  // Perceived brightness (YIQ-like)
  return r * 0.299 + g * 0.587 + b * 0.114 > 150
}
