import { useEffect, useState, type ReactNode } from 'react'
import { Check, Palette, RotateCcw, Settings2, Type, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { FlowProgressBar } from '../flow-execution/FlowProgressBar'
import {
  ACCENT_PRESETS,
  BG_PRESETS,
  DEFAULT_THEME,
  RADIUS_OPTIONS,
  TEXT_PRESETS,
  isHexColor,
  themeVars,
  type FormTheme,
} from '../../lib/theme'

interface SettingsDialogProps {
  formTitle: string
  theme?: FormTheme | null
  onSave: (settings: { title: string; theme: FormTheme }) => void | Promise<void>
  onClose: () => void
  saveError?: string | null
}

export function SettingsDialog({ formTitle, theme, onSave, onClose, saveError }: SettingsDialogProps) {
  const initialPrimary = theme?.primaryColor || DEFAULT_THEME.primaryColor
  const initialBackground = theme?.backgroundColor || DEFAULT_THEME.backgroundColor
  const initialText = theme?.textColor || DEFAULT_THEME.textColor
  const initialRadius = theme?.radius || DEFAULT_THEME.radius
  const [title, setTitle] = useState(formTitle)
  const [titleError, setTitleError] = useState('')
  const [primaryColor, setPrimary] = useState(initialPrimary)
  const [backgroundColor, setBg] = useState(initialBackground)
  const [textColor, setText] = useState(initialText)
  const [radius, setRadius] = useState<NonNullable<FormTheme['radius']>>(initialRadius)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const draft: FormTheme = { primaryColor, backgroundColor, textColor, radius }
  const hasChanges =
    title !== formTitle ||
    primaryColor !== initialPrimary ||
    backgroundColor !== initialBackground ||
    textColor !== initialText ||
    radius !== initialRadius
  const canSave = hasChanges && title.trim().length > 0 && !isSaving

  function resetAppearance() {
    setPrimary(DEFAULT_THEME.primaryColor)
    setBg(DEFAULT_THEME.backgroundColor)
    setText(DEFAULT_THEME.textColor)
    setRadius(DEFAULT_THEME.radius)
  }

  async function save() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setTitleError('Enter a name for this form.')
      return
    }

    setIsSaving(true)
    try {
      await onSave({ title: trimmedTitle, theme: draft })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-settings-title"
        aria-describedby="form-settings-description"
        className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[#f7f4ee] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
      >
        <header className="flex flex-none items-center justify-between gap-4 border-b border-[#e4ddd4] bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f5e9e3] text-[#a9583e]">
              <Settings2 size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="form-settings-title" className="text-base font-semibold text-[#141413] sm:text-lg">
                Form settings
              </h2>
              <p id="form-settings-description" className="truncate text-xs text-[#77736b] sm:text-sm">
                Name and style the form your respondents will see.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[#77736b] transition-colors hover:bg-[#f2eee7] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
            aria-label="Close form settings"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:p-6 lg:overflow-y-auto">
            <SettingsSection
              icon={<Type size={16} aria-hidden="true" />}
              title="Form identity"
              description="This name appears in your workspace and respondent-facing form."
            >
              <label htmlFor="form-name" className="text-sm font-medium text-[#282622]">
                Form name
              </label>
              <input
                id="form-name"
                autoFocus
                value={title}
                maxLength={255}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? 'form-name-error form-name-count' : 'form-name-count'}
                onChange={(event) => {
                  setTitle(event.target.value)
                  if (titleError) setTitleError('')
                }}
                className={`h-11 rounded-lg border bg-white px-3.5 text-sm text-[#141413] outline-none transition-[border-color,box-shadow] placeholder:text-[#99948b] focus:ring-2 ${
                  titleError
                    ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/15'
                    : 'border-[#ded7ce] focus:border-[#cc785c] focus:ring-[#cc785c]/15'
                }`}
                placeholder="Customer feedback survey"
              />
              <div className="flex min-h-5 items-start justify-between gap-3 text-xs">
                <span id="form-name-error" className="text-[#b33d3d]">
                  {titleError}
                </span>
                <span id="form-name-count" className="ml-auto flex-none text-[#8e8b82]">
                  {title.length}/255
                </span>
              </div>
            </SettingsSection>

            <SettingsSection
              icon={<Palette size={16} aria-hidden="true" />}
              title="Appearance"
              description="Choose a focused palette that carries through buttons, selections, text, and surfaces."
              action={
                <button
                  type="button"
                  onClick={resetAppearance}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#8f4f3b] hover:bg-[#f8ece7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Reset
                </button>
              }
            >
              <ColorField
                label="Accent color"
                description="Used for actions, progress, selected answers, and focus states."
                value={primaryColor}
                onChange={setPrimary}
                presets={ACCENT_PRESETS}
              />
              <div className="h-px bg-[#ece6de]" />
              <ColorField
                label="Page background"
                description="Sets the canvas behind the respondent form."
                value={backgroundColor}
                onChange={setBg}
                presets={BG_PRESETS}
              />
              <div className="h-px bg-[#ece6de]" />
              <ColorField
                label="Text color"
                description="Used for labels, values, and headings across the form."
                value={textColor}
                onChange={setText}
                presets={TEXT_PRESETS}
              />
              <div className="h-px bg-[#ece6de]" />
              <div className="flex flex-col gap-2.5">
                <div>
                  <p className="text-sm font-medium text-[#282622]">Corner style</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#7c776f]">
                    Applied consistently to cards, fields, and buttons.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Corner style">
                  {RADIUS_OPTIONS.map((option) => {
                    const isActive = radius === option.value
                    const previewRadius =
                      option.value === 'sharp'
                        ? 'rounded-sm'
                        : option.value === 'rounded'
                          ? 'rounded-lg'
                          : 'rounded-full'
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setRadius(option.value)}
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-lg border px-2 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30 ${
                          isActive
                            ? 'border-[#cc785c] bg-[#fff5f1] text-[#a9583e]'
                            : 'border-[#ded7ce] bg-white text-[#666159] hover:border-[#c9b4a8] hover:bg-[#fbfaf7]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-5 w-10 border-2 ${previewRadius} ${
                            isActive ? 'border-[#cc785c] bg-[#f7ddd4]' : 'border-[#aaa39a] bg-[#eee9e2]'
                          }`}
                        />
                        <span className="truncate text-xs font-medium">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </SettingsSection>
          </div>

          <PreviewPanel title={title.trim() || 'Untitled form'} theme={draft} />
        </div>

        <footer className="flex flex-none flex-col gap-3 border-t border-[#e4ddd4] bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0" aria-live="polite">
            {saveError ? (
              <p role="alert" className="text-sm text-[#b33d3d]">
                {saveError}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-xs text-[#77736b]">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${hasChanges ? 'bg-[#d18a35]' : 'bg-[#6b8f71]'}`}
                />
                {hasChanges ? 'You have unsaved changes.' : 'Everything is up to date.'}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={!canSave}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function SettingsSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#e3dcd3] bg-white shadow-[0_1px_2px_rgba(20,20,19,0.03)]">
      <div className="flex items-start gap-3 border-b border-[#ece6de] px-4 py-3.5">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[#f6ebe6] text-[#a9583e]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#282622]">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-[#7c776f]">{description}</p>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  )
}

function PreviewPanel({ title, theme }: { title: string; theme: FormTheme }) {
  return (
    <aside className="flex flex-col border-t border-[#e4ddd4] bg-[#eee8df] lg:min-h-0 lg:border-l lg:border-t-0 lg:overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#ddd5cb] px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#77736b]">Respondent view</p>
          <p className="mt-0.5 text-xs text-[#8e8b82]">Updates as you make changes.</p>
        </div>
        <span className="rounded-full border border-[#d6cec4] bg-white px-2.5 py-1 text-[11px] font-medium text-[#666159]">
          Live preview
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <div
          style={themeVars(theme)}
          className="w-full max-w-xl overflow-hidden rounded-[var(--ponko-radius-card,16px)] border border-black/10 bg-[var(--ponko-bg,#faf9f5)] shadow-[0_22px_50px_rgba(54,45,36,0.13)]"
        >
          <div className="border-b border-black/5 px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ponko-foreground-faint,#8e8b82)]">Step 2 of 4</span>
              <span className="text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">50% complete</span>
            </div>
            <FlowProgressBar current={2} total={4} />
          </div>
          <div className="p-5 sm:p-6">
            <div className="mb-5">
              <h4 className="text-xl font-semibold text-[var(--ponko-foreground,#141413)]">{title}</h4>
              <p className="mt-1 text-sm text-[var(--ponko-foreground-muted,#77736b)]">Tell us a little about your experience.</p>
            </div>
            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--ponko-foreground,#141413)]">
                What should we call you?
                <input
                  readOnly
                  tabIndex={-1}
                  placeholder="Type your answer…"
                  className="h-11 w-full rounded-[var(--ponko-radius,8px)] border border-[#ded7ce] bg-white px-3.5 text-sm text-[var(--ponko-foreground,#141413)] outline-none placeholder:text-[var(--ponko-foreground-faint,#99948b)]"
                />
              </label>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium text-[var(--ponko-foreground,#141413)]">How was your experience?</legend>
                {['Great', 'It was okay', 'Needs improvement'].map((option, index) => (
                  <div
                    key={option}
                    className={`flex items-center gap-3 rounded-[var(--ponko-radius,8px)] border px-3 py-2.5 text-sm ${
                      index === 0
                        ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)] text-[var(--ponko-foreground,#141413)]'
                        : 'border-[#ded7ce] bg-white text-[var(--ponko-foreground-muted,#666159)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        index === 0 ? 'border-[var(--ponko-primary,#cc785c)]' : 'border-[#bdb5ac]'
                      }`}
                    >
                      {index === 0 && <span className="h-2 w-2 rounded-full bg-[var(--ponko-primary,#cc785c)]" />}
                    </span>
                    {option}
                  </div>
                ))}
              </fieldset>
              <Button type="button" tabIndex={-1} className="self-start">
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function ColorField({
  label,
  description,
  value,
  onChange,
  presets,
}: {
  label: string
  description: string
  value: string
  onChange: (hex: string) => void
  presets: string[]
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const valid = isHexColor(text)

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-sm font-medium text-[#282622]">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-[#7c776f]">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} presets`}>
        {presets.map((preset) => {
          const isSelected = value.toLowerCase() === preset.toLowerCase()
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              style={{ backgroundColor: preset }}
              aria-label={`${label} ${preset}`}
              aria-pressed={isSelected}
              title={preset}
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 motion-reduce:transition-none ${
                isSelected ? 'border-[#282622] ring-2 ring-[#282622]/15' : 'border-black/10'
              }`}
            >
              {isSelected && (
                <Check
                  size={15}
                  aria-hidden="true"
                  className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                  style={{ color: isLightColor(preset) ? '#141413' : '#ffffff' }}
                />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex min-w-0 items-start gap-2">
        <label className="relative flex h-10 w-10 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[#ded7ce] bg-white focus-within:ring-2 focus-within:ring-[#cc785c]/30">
          <input
            type="color"
            value={isHexColor(value) ? value.slice(0, 7) : '#cc785c'}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
          <Palette size={16} aria-hidden="true" className="text-[#666159]" />
        </label>
        <div className="min-w-0 flex-1">
          <input
            value={text}
            aria-label={`${label} hex value`}
            aria-invalid={!valid}
            onChange={(event) => {
              setText(event.target.value)
              if (isHexColor(event.target.value)) onChange(event.target.value)
            }}
            placeholder="#rrggbb"
            className={`h-10 w-full rounded-lg border bg-white px-3 font-mono text-sm text-[#141413] outline-none transition-[border-color,box-shadow] placeholder:text-[#99948b] focus:ring-2 ${
              valid
                ? 'border-[#ded7ce] focus:border-[#cc785c] focus:ring-[#cc785c]/15'
                : 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/15'
            }`}
          />
          {!valid && <p className="mt-1 text-xs text-[#b33d3d]">Enter a valid hex color.</p>}
        </div>
      </div>
    </div>
  )
}

function isLightColor(hex: string): boolean {
  const value = hex.replace(/^#/, '')
  const red = parseInt(value.slice(0, 2), 16) || 0
  const green = parseInt(value.slice(2, 4), 16) || 0
  const blue = parseInt(value.slice(4, 6), 16) || 0
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150
}
