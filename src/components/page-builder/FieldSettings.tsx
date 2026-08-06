import { lazy, Suspense, useEffect, useState } from 'react'
import type {
  ConditionAction,
  ConditionOperator,
  FieldCondition,
  FieldValidationRules,
  FormPage,
  FormReference,
  PageField,
  PageFieldOption,
  PageFieldType,
} from '../../lib/page-builder/types'
import {
  Check,
  Calculator,
  Eye,
  Info,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { addressRequiredParts } from '../../lib/page-builder/conditions'
import {
  inferSatisfactionPreset,
  ratingFaceIcon,
  satisfactionOptions,
  SVG_STAR_MARKER,
  TEXT_ONLY_MARKER,
  type SatisfactionPreset,
} from '../../lib/page-builder/satisfaction'
import { StarIcon } from '../ui/StarIcon'
import { ErrorBoundary } from '../layout/ErrorBoundary'
import {
  Field,
  FieldGroup,
  inputClass,
  SettingsAction,
  SettingsSection,
  SettingsToggle,
} from './Shared'
import {
  FIELD_CATEGORIES,
  FIELD_ITEMS,
  fieldOption,
  fieldPaletteItem,
  isContentField,
  mediaOption,
  setFieldOption,
  setMediaOption,
} from './PageBuilderConfig'
import {
  slugForOptionValue,
  tempId,
  variableToken,
} from './PageBuilderUtils'
import type { EditablePageField } from './PageBuilderTypes'
import { ComputationDialog } from './ComputationDialog'
import { LogicDialog } from './LogicDialog'
import { OptionsDialog } from './OptionsDialog'
import { RulesDialog } from './RulesDialog'

const RichTextEditor = lazy(() => import('./RichTextEditor'))
interface FieldSettingsProps {
  field: EditablePageField
  pages: FormPage[]
  fields: PageField[]
  references: FormReference[]
  onUpdate: (patch: Partial<PageField>) => void
  onMoveToPage: (pageId: number) => void
  onSaveConditions: (conditions: FieldCondition[]) => void
}

const RATING_PRESETS: Array<{
  value: Exclude<SatisfactionPreset, 'custom'>
  label: string
  description: string
}> = [
  { value: 'five-point', label: 'Emoji mood', description: 'Expressive and friendly' },
  { value: 'icon-faces', label: 'Icon faces', description: 'Clean, consistent symbols' },
  { value: 'svg-stars', label: 'Review stars', description: 'Familiar Google-style rating' },
  { value: 'text-only', label: 'Text labels', description: 'Clear words, no icons' },
  { value: 'numbers', label: 'Number scale', description: 'Simple 1–5 score' },
  { value: 'nps', label: 'NPS scale', description: 'Standard 0–10 score' },
]

function RatingPresetPreview({ preset }: { preset: Exclude<SatisfactionPreset, 'custom'> }) {
  if (preset === 'svg-stars') {
    return (
      <span className="flex items-center gap-0.5 text-[#f4b400]" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((star) => <StarIcon key={star} size={16} filled />)}
      </span>
    )
  }
  if (preset === 'icon-faces') {
    return <span className="text-lg tracking-[0.2em] text-[#77736b]" aria-hidden="true">☹ ◯ ☺</span>
  }
  if (preset === 'text-only') {
    return <span className="flex gap-1 text-[9px] font-semibold text-[#77736b]" aria-hidden="true"><i className="not-italic">Poor</i><i className="not-italic">Okay</i><i className="not-italic">Great</i></span>
  }
  if (preset === 'numbers') {
    return <span className="text-xs font-semibold tracking-[0.28em] text-[#77736b]" aria-hidden="true">1 2 3 4 5</span>
  }
  if (preset === 'nps') {
    return <span className="text-[10px] font-semibold tracking-[0.11em] text-[#77736b]" aria-hidden="true">0 ··· 5 ··· 10</span>
  }
  return <span className="text-lg tracking-[0.15em]" aria-hidden="true">😡 😐 😍</span>
}

export function SatisfactionSettings({ field, onUpdate }: Pick<FieldSettingsProps, 'field' | 'onUpdate'>) {
  const inferredPreset = inferSatisfactionPreset(field.options)
  const [preset, setPreset] = useState<SatisfactionPreset>(inferredPreset)
  const options = field.options ?? satisfactionOptions('five-point')

  useEffect(() => {
    const inferred = inferSatisfactionPreset(field.options)
    if (inferred !== 'custom') setPreset(inferred)
    else setPreset('custom')
  }, [field.id, field.options])

  function selectPreset(nextPreset: SatisfactionPreset) {
    setPreset(nextPreset)
    if (nextPreset !== 'custom') onUpdate({ options: satisfactionOptions(nextPreset) })
  }

  function updateOption(index: number, patch: Partial<PageFieldOption>) {
    setPreset('custom')
    onUpdate({
      options: options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option),
    })
  }

  function addOption() {
    const numericValues = options.map((option) => Number(option.value)).filter(Number.isFinite)
    const value = String(numericValues.length ? Math.max(...numericValues) + 1 : options.length + 1)
    setPreset('custom')
    onUpdate({ options: [...options, { label: `Rating ${value}`, value, emoji: value }] })
  }

  function removeOption(index: number) {
    if (options.length <= 2) return
    setPreset('custom')
    onUpdate({ options: options.filter((_, optionIndex) => optionIndex !== index) })
  }

  return (
    <div className="rounded-xl border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <div>
        <p className="text-xs font-semibold text-[#38342f]">Choose a rating look</p>
        <p className="mt-0.5 text-[11px] leading-4 text-[#8e8b82]">Each preset includes respondent-friendly labels and numeric values.</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rating appearance preset">
        {RATING_PRESETS.map((item) => {
          const selected = preset === item.value
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectPreset(item.value)}
              className={`relative flex min-h-[92px] min-w-0 flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30 ${
                selected
                  ? 'border-[#cc785c] bg-white shadow-[0_0_0_1px_rgba(204,120,92,0.15)]'
                  : 'border-[#e3ddd5] bg-white/70 hover:border-[#cfc4b8] hover:bg-white'
              }`}
            >
              <span className="flex min-h-7 w-full items-center"><RatingPresetPreview preset={item.value} /></span>
              <span className="w-full min-w-0 pr-4">
                <span className={`block truncate text-xs font-semibold ${selected ? 'text-[#a9583e]' : 'text-[#38342f]'}`}>{item.label}</span>
                <span className="mt-0.5 block truncate text-[10px] text-[#8e8b82]">{item.description}</span>
              </span>
              {selected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#cc785c] text-white">
                  <Check size={10} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={preset === 'custom' || preset === 'stars'}
          onClick={() => selectPreset('custom')}
          className={`col-span-2 flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30 ${
            preset === 'custom' || preset === 'stars'
              ? 'border-[#cc785c] bg-white text-[#a9583e]'
              : 'border-[#e3ddd5] bg-white/70 text-[#6c6a64] hover:border-[#cfc4b8] hover:bg-white'
          }`}
        >
          <span>
            <span className="block text-xs font-semibold">Custom scale</span>
            <span className="mt-0.5 block text-[10px] text-[#8e8b82]">Keep these values and tune every label or visual</span>
          </span>
          {(preset === 'custom' || preset === 'stars') && <Check size={14} aria-hidden="true" />}
        </button>
      </div>
      <div className="my-3 h-px bg-[#e6dfd8]" />
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#38342f]">Labels and values</p>
          <p className="mt-0.5 text-[10px] text-[#8e8b82]">Editing a preset turns it into a custom scale.</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={`${option.value}-${index}`} className="grid grid-cols-[64px_minmax(0,1fr)_64px_32px] gap-2">
            {option.emoji === SVG_STAR_MARKER ? (
              <span
                aria-label={`Rating ${index + 1} star visual`}
                className="flex h-10 items-center justify-center rounded-md border border-[#e6dfd8] bg-white text-[#f4b400]"
              >
                <StarIcon size={22} filled />
              </span>
            ) : option.emoji === TEXT_ONLY_MARKER ? (
              <span className="flex h-10 items-center justify-center rounded-md border border-[#e6dfd8] bg-white px-1 text-[10px] font-semibold text-[#77736b]">Text</span>
            ) : ratingFaceIcon(option.emoji) ? (
              <span className="flex h-10 items-center justify-center rounded-md border border-[#e6dfd8] bg-white text-lg text-[#77736b]">☺</span>
            ) : (
              <input
                aria-label={`Rating ${index + 1} visual`}
                value={option.emoji ?? ''}
                onChange={(event) => updateOption(index, { emoji: event.target.value || null })}
                className={inputClass}
                placeholder="😊"
              />
            )}
            <input
              aria-label={`Rating ${index + 1} label`}
              value={option.label}
              onChange={(event) => updateOption(index, { label: event.target.value })}
              className={inputClass}
              placeholder="Satisfied"
            />
            <input
              aria-label={`Rating ${index + 1} value`}
              type="number"
              value={option.value}
              onChange={(event) => updateOption(index, { value: event.target.value })}
              className={inputClass}
              placeholder="5"
            />
            <button
              type="button"
              aria-label={`Remove rating ${index + 1}`}
              onClick={() => removeOption(index)}
              disabled={options.length <= 2}
              className="rounded-md text-[#8e8b82] hover:bg-white hover:text-[#c64545] disabled:opacity-30"
            >
              <X size={14} className="mx-auto" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addOption} className="mt-3 text-xs font-medium text-[#a9583e] hover:text-[#7f3f2d]">
        + Add rating level
      </button>
      <p className="mt-2 text-xs leading-5 text-[#8e8b82]">Values stay numeric for logic, calculations, submissions, and exports. Custom visuals accept emoji or image URLs.</p>
    </div>
  )
}

export function FieldSettings({ field, pages, fields, references, onUpdate, onMoveToPage, onSaveConditions }: FieldSettingsProps) {
  const [conditions, setConditions] = useState(field.conditions)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [logicOpen, setLogicOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [computationOpen, setComputationOpen] = useState(false)
  const rules = field.validationRules ?? {}
  const editablePages = pages.filter((page) => !page.isFinal)
  const addressRequired = addressRequiredParts(field)

  useEffect(() => {
    setConditions(field.conditions)
  }, [field.id, field.conditions])

  function updateCondition(index: number, patch: Partial<FieldCondition>) {
    const next = conditions.map((item, i) => (i === index ? { ...item, ...patch } : item))
    setConditions(next)
    onSaveConditions(next)
  }

  function addCondition() {
    const next = [
      ...conditions,
      {
        id: tempId(),
        fieldId: field.id,
        sourceFieldBinding: fields.find((item) => item.id !== field.id)?.bindVariable ?? '',
        operator: 'equals' as ConditionOperator,
        value: '',
        action: 'show' as ConditionAction,
        createdAt: new Date(),
      },
    ]
    setConditions(next)
    onSaveConditions(next)
  }

  function removeCondition(index: number) {
    const next = conditions.filter((_, i) => i !== index)
    setConditions(next)
    onSaveConditions(next)
  }

  function updateRules(patch: Partial<FieldValidationRules>) {
    const next = { ...rules, ...patch }
    const normalized = Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== '' && value != null),
    ) as FieldValidationRules
    onUpdate({ validationRules: Object.keys(normalized).length > 0 ? normalized : null })
  }

  function numberRule(value: string): number | null {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  function changeFieldType(fieldType: PageFieldType) {
    if (fieldType === 'satisfaction' && field.fieldType !== 'satisfaction') {
      onUpdate({ fieldType, options: satisfactionOptions('five-point') })
      return
    }
    if (fieldType === 'recaptcha' && field.fieldType !== 'recaptcha') {
      onUpdate({ fieldType, required: true, options: null, placeholder: null })
      return
    }
    onUpdate({ fieldType })
  }

  const paletteItem = fieldPaletteItem(field.fieldType)
  const collectsAnswer = !isContentField(field) && field.fieldType !== 'recaptcha'
  const supportsPlaceholder = ['text', 'email', 'number', 'textarea', 'select'].includes(field.fieldType)
  const supportsRules = collectsAnswer && !['computation', 'satisfaction'].includes(field.fieldType)
  const supportsLogic = !isContentField(field) && field.fieldType !== 'computation'

  return (
    <div className="flex flex-col gap-5 pb-2">
      <header className="rounded-xl border border-[#e6dfd8] bg-[#f5f0e8] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white text-[#cc785c] shadow-sm">
            {paletteItem.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#8e8b82]">Configure field</p>
            <h3 className="mt-1 truncate text-lg font-medium text-[#141413]">{field.label || paletteItem.label}</h3>
            <p className="mt-1 text-xs leading-5 text-[#6c6a64]">{paletteItem.description}</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 text-xs leading-5 text-[#6c6a64]">
          <Info size={14} className="mt-0.5 flex-none text-[#cc785c]" />
          <p>
            Changes are kept in this draft. Use <span className="font-medium text-[#141413]">Save changes</span> in the top bar when you are ready.
          </p>
        </div>
      </header>

      <SettingsSection
        title="What people see"
        description="The wording and content shown on the published form."
        icon={<Eye size={15} />}
      >
        <Field
          label={field.fieldType === 'recaptcha' ? 'Label (optional)' : field.fieldType === 'content' ? 'Section name' : 'Question or label'}
          hint={field.fieldType === 'recaptcha' ? 'Leave this blank to show only the verification widget.' : undefined}
        >
          <input
            value={field.label}
            onChange={(event) => onUpdate({ label: event.target.value })}
            className={inputClass}
            placeholder={field.fieldType === 'recaptcha' ? 'Optional heading' : 'Enter the text people will see'}
          />
        </Field>

        <Field label="Field type" hint="Changing the type can change which settings and answers are available.">
          <select value={field.fieldType} onChange={(event) => changeFieldType(event.target.value as PageFieldType)} className={inputClass}>
            {FIELD_CATEGORIES.map((category) => (
              <optgroup key={category} label={category}>
                {FIELD_ITEMS.filter((item) => item.category === category && !item.preset).map((item) => (
                  <option key={item.type} value={item.type}>{item.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        {field.fieldType === 'content' ? (
          <FieldGroup label="Instructions">
            <p className="-mt-0.5 text-xs leading-5 text-[#8e8b82]">Use this for context, directions, headings, or links. It does not collect an answer.</p>
            <Suspense
              fallback={<div role="status" aria-label="Loading rich text editor" className="h-48 animate-pulse rounded-md border border-[#e6dfd8] bg-[#faf9f5]" />}
            >
              <ErrorBoundary key={field.id}>
                <RichTextEditor value={field.placeholder ?? ''} onChange={(html) => onUpdate({ placeholder: html || null })} />
              </ErrorBoundary>
            </Suspense>
          </FieldGroup>
        ) : field.fieldType === 'media' ? (
          <>
            <Field label="Media type">
              <select
                value={mediaOption(field, 'type') || 'image'}
                onChange={(event) => onUpdate({ options: setMediaOption(field, 'type', event.target.value) })}
                className={inputClass}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="embed">Embed</option>
              </select>
            </Field>
            <Field label="Media URL" hint="Use a public URL that respondents can access.">
              <input
                value={field.placeholder ?? ''}
                onChange={(event) => onUpdate({ placeholder: event.target.value || null })}
                className={inputClass}
                placeholder="https://example.com/image.jpg"
              />
            </Field>
            <Field label="Caption (optional)">
              <input
                value={mediaOption(field, 'caption')}
                onChange={(event) => onUpdate({ options: setMediaOption(field, 'caption', event.target.value) })}
                className={inputClass}
                placeholder="Explain what this media shows"
              />
            </Field>
          </>
        ) : (
          <>
            {supportsPlaceholder && (
              <Field
                label={field.fieldType === 'select' ? 'Empty choice text' : 'Example or hint (optional)'}
                hint={field.fieldType === 'select' ? 'Shown before someone chooses an option.' : 'Shown inside the empty answer box.'}
              >
                <input
                  value={field.placeholder ?? ''}
                  onChange={(event) => onUpdate({ placeholder: event.target.value || null })}
                  className={inputClass}
                  placeholder={field.fieldType === 'select' ? 'Select an option…' : 'Add a useful example'}
                />
              </Field>
            )}
            {field.fieldType === 'file_upload' && (
              <Field label="Help text (optional)" hint="Tell people what to upload before they choose a file.">
                <input
                  value={field.placeholder ?? ''}
                  onChange={(event) => onUpdate({ placeholder: event.target.value || null })}
                  className={inputClass}
                  placeholder="Upload an image or file."
                />
              </Field>
            )}
          </>
        )}
      </SettingsSection>

      <SettingsSection
        title="Placement"
        description="Where this field appears and how much horizontal space it uses."
        icon={<SlidersHorizontal size={15} />}
      >
        <Field label="Page">
          <select value={field.pageId} onChange={(event) => onMoveToPage(Number(event.target.value))} className={inputClass}>
            {editablePages.map((page) => (
              <option key={page.id} value={page.id}>{page.title || `Page ${page.position + 1}`}</option>
            ))}
          </select>
        </Field>
        <Field label="Width" hint="Half width sits beside another half-width field on larger screens.">
          <select value={field.width} onChange={(event) => onUpdate({ width: event.target.value as 'full' | 'half' })} className={inputClass}>
            <option value="full">Full row</option>
            <option value="half">Half row</option>
          </select>
        </Field>
      </SettingsSection>

      {collectsAnswer && field.fieldType !== 'computation' && (
        <SettingsSection
          title="Answer behavior"
          description="Control what people can submit and how their answer is collected."
          icon={<Settings2 size={15} />}
        >
          <SettingsToggle
            label="Answer required"
            description="People must answer this field before they can continue."
            checked={field.required}
            onChange={(checked) => onUpdate({ required: checked })}
          />

          {field.fieldType === 'address' && (
            <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
              <p className="text-sm font-medium text-[#141413]">Required address parts</p>
              <p className="mt-0.5 text-xs leading-5 text-[#8e8b82]">Choose exactly which parts of the address must be completed.</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {[
                  ['currentAddress', 'Street address'],
                  ['apartment', 'Apartment or suite'],
                  ['city', 'City'],
                  ['stateProvince', 'State or province'],
                  ['zipPostalCode', 'ZIP or postal code'],
                  ['country', 'Country'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-[#3d3d3a]">
                    <input
                      type="checkbox"
                      checked={addressRequired[key as keyof typeof addressRequired]}
                      onChange={(event) => updateRules({
                        addressRequired: { ...addressRequired, [key]: event.target.checked },
                      })}
                      className="h-4 w-4 accent-[#cc785c]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {field.fieldType === 'satisfaction' && <SatisfactionSettings field={field} onUpdate={onUpdate} />}

          {field.fieldType === 'file_upload' && (
            <>
              <Field label="Accepted files">
                <select
                  value={fieldOption(field, 'accept') || 'any'}
                  onChange={(event) => onUpdate({ options: setFieldOption(field, 'accept', event.target.value) })}
                  className={inputClass}
                >
                  <option value="any">Any file type</option>
                  <option value="image">Images only</option>
                  <option value="document">Documents only</option>
                  <option value="custom">Custom file types</option>
                </select>
              </Field>
              {(fieldOption(field, 'accept') || 'any') === 'custom' && (
                <Field label="Allowed extensions or MIME types" hint="Separate multiple values with commas.">
                  <input
                    value={fieldOption(field, 'acceptCustom')}
                    onChange={(event) => onUpdate({ options: setFieldOption(field, 'acceptCustom', event.target.value) })}
                    className={inputClass}
                    placeholder=".pdf, image/*"
                  />
                </Field>
              )}
              <SettingsToggle
                label="Allow multiple files"
                description="People can attach more than one file to this answer."
                checked={fieldOption(field, 'multiple') === 'true'}
                onChange={(checked) => onUpdate({ options: setFieldOption(field, 'multiple', checked ? 'true' : 'false') })}
              />
            </>
          )}

          {['select', 'checkbox', 'radio'].includes(field.fieldType) && (
            <>
              <SettingsAction
                title="Answer options"
                description="Edit the labels people see and the values saved with their response."
                status={`${(field.options ?? []).length} ${(field.options ?? []).length === 1 ? 'option' : 'options'}`}
                onClick={() => setOptionsOpen(true)}
              />
              <SettingsToggle
                label="Use prices in payments"
                description="Give each option a price that can feed a payment or calculated total."
                checked={Boolean(rules.optionPricesEnabled)}
                onChange={(checked) => updateRules({ optionPricesEnabled: checked ? true : null })}
              />
            </>
          )}
        </SettingsSection>
      )}

      {field.fieldType === 'recaptcha' && (
        <SettingsSection
          title="Spam protection"
          description="How this verification works on the published form."
          icon={<ShieldCheck size={15} />}
        >
          <div className="flex items-start gap-2 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 text-xs leading-5 text-[#6c6a64]">
            <Info size={14} className="mt-0.5 flex-none text-[#cc785c]" />
            Uses Google reCAPTCHA v2 credentials from Settings → Integrations → Security. The secret key is never exposed to respondents.
          </div>
        </SettingsSection>
      )}

      {field.fieldType === 'computation' && (
        <SettingsSection
          title="Calculation"
          description="Define the value this field produces from answers and references."
          icon={<Calculator size={15} />}
        >
          <SettingsAction
            title="Open calculation studio"
            description="Choose the output type, build with typed variables, and preview the result."
            status={rules.computation?.outputMode === 'text'
              ? 'Text result'
              : rules.computation?.numericType === 'integer'
                ? 'Whole number'
                : rules.computation?.numericType === 'decimal'
                  ? 'Decimal'
                  : 'Number'}
            onClick={() => setComputationOpen(true)}
          />
        </SettingsSection>
      )}

      {(collectsAnswer || supportsLogic) && (
        <SettingsSection
          title="Data and logic"
          description="Control how this field is saved, validated, and shown conditionally."
          icon={<Settings2 size={15} />}
        >
          {collectsAnswer && (
            <Field label="Answer variable" hint={`Use ${variableToken(field.bindVariable || 'variable_name')} in calculations, logic, payments, and exports.`}>
              <input
                value={field.bindVariable}
                onChange={(event) => onUpdate({ bindVariable: slugForOptionValue(event.target.value) })}
                className={inputClass}
                placeholder="answer_variable"
              />
            </Field>
          )}
          {supportsRules && (
            <SettingsAction
              title="Validation rules"
              description="Set allowed characters, lengths, ranges, and a helpful error message."
              status={field.validationRules ? 'Configured' : 'Optional'}
              onClick={() => setRulesOpen(true)}
            />
          )}
          {supportsLogic && (
            <SettingsAction
              title="Conditional visibility"
              description="Show or hide this field based on another answer or reference."
              status={`${conditions.length} ${conditions.length === 1 ? 'rule' : 'rules'}`}
              onClick={() => setLogicOpen(true)}
            />
          )}
        </SettingsSection>
      )}

      {rulesOpen && (
        <RulesDialog
          field={field}
          rules={rules}
          onClose={() => setRulesOpen(false)}
          onClear={() => onUpdate({ validationRules: null })}
          onUpdate={updateRules}
          numberRule={numberRule}
        />
      )}

      {optionsOpen && (
        <OptionsDialog
          field={field}
          references={references.filter((reference) => reference.type === 'number')}
          showPrices={Boolean(rules.optionPricesEnabled)}
          onClose={() => setOptionsOpen(false)}
          onChange={(options) => onUpdate({ options })}
        />
      )}

      {computationOpen && (
        <ComputationDialog
          field={field}
          fields={fields}
          references={references}
          computation={rules.computation ?? {
            mode: 'expression',
            editorMode: 'visual',
            outputMode: 'number',
            numericType: 'automatic',
            fieldBindings: [],
            terms: [],
            adjustments: [],
            showBreakdown: true,
          }}
          onClose={() => setComputationOpen(false)}
          onChange={(computation) => updateRules({ computation })}
        />
      )}

      {logicOpen && (
        <LogicDialog
          field={field}
          fields={fields}
          references={references}
          conditions={conditions}
          onClose={() => setLogicOpen(false)}
          onAdd={addCondition}
          onUpdate={updateCondition}
          onRemove={removeCondition}
        />
      )}
    </div>
  )
}










