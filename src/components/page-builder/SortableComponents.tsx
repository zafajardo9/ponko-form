import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GitBranch, GripVertical, ShieldCheck, X } from 'lucide-react'
import type { FormPage, PageField, PageFieldType } from '../../lib/page-builder/types'
import type { FieldConfig } from '../../lib/form-field-types'
import { contentFieldHtml } from '../form-builder/fields/FieldRenderer'
import { FieldPreview } from '../form-builder/fields/FieldPreview'
import { fieldPaletteItem, isContentField } from './PageBuilderConfig'

interface SortablePageTabProps {
  page: FormPage
  active: boolean
  onSelect: () => void
}

export function SortablePageTab({ page, active, onSelect }: SortablePageTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
    disabled: page.isFinal,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`inline-flex flex-none items-center overflow-hidden rounded-md border text-sm ${
        active
          ? 'border-[#cc785c] bg-white text-[#141413] shadow-sm'
          : 'border-[#e6dfd8] bg-[#f5f0e8] text-[#6c6a64] hover:text-[#141413]'
      } ${isDragging ? 'opacity-70' : ''}`}
    >
      {!page.isFinal && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-8 w-7 items-center justify-center border-r border-[#e6dfd8] text-[#8e8b82] hover:bg-[#efe9de] hover:text-[#141413]"
          aria-label={`Reorder ${page.title}`}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        className="h-8 min-w-0 max-w-44 truncate px-3 text-left"
      >
        {page.title}
        {page.isFinal && <span className="ml-1 text-[#cc785c]">Final</span>}
      </button>
    </div>
  )
}

interface SortableFieldCardProps {
  field: PageField
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}

/** Field types that render their own bespoke preview inside the card. */
const NO_CONTROL_PREVIEW: PageFieldType[] = ['content', 'media', 'payment', 'computation']

function toFieldConfig(field: PageField): FieldConfig {
  return {
    id: field.id,
    type: field.fieldType,
    label: field.label || 'Untitled field',
    placeholder: field.placeholder,
    required: field.required,
    options: (field.options ?? []).map((option) => ({
      label: option.label,
      value: option.value,
      emoji: option.emoji,
      price: option.price,
      priceReference: option.priceReference,
      additionalPrice: option.additionalPrice,
      additionalPriceReference: option.additionalPriceReference,
    })),
    validationRules: field.validationRules,
  }
}

export function SortableFieldCard({ field, selected, onSelect, onDelete }: SortableFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })
  const paletteItem = fieldPaletteItem(field.fieldType)
  const showControlPreview = !NO_CONTROL_PREVIEW.includes(field.fieldType)
  const hasValidationRules = Boolean(
    field.validationRules && Object.keys(field.validationRules).length > 0,
  )

  return (
    <div
      ref={setNodeRef}
      data-field-card-id={field.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex min-w-0 rounded-lg border text-left transition-colors ${
        selected ? 'border-[#cc785c] shadow-sm' : 'border-[#e6dfd8] hover:border-[#cc785c]/60'
      } ${field.fieldType === 'content' ? 'bg-transparent' : 'bg-[#faf9f5]'} ${field.width === 'full' ? 'sm:col-span-2' : ''} ${isDragging ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex w-9 flex-none items-center justify-center rounded-l-lg text-[#8e8b82] hover:bg-[#efe9de] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c]/30"
        aria-label={`Reorder ${field.label || 'field'}`}
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="relative">
          <button
            type="button"
            onClick={onSelect}
            className="block w-full p-4 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c]/30"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#141413]">
                  {field.label || 'Untitled field'}
                  {field.required && <span className="text-[#c64545]"> *</span>}
                </p>
              </div>
              <div className="flex flex-none items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded bg-[#efe9de] px-2 py-1 text-[#6c6a64]">
                  {paletteItem.icon} {paletteItem.label}
                </span>
                <span className={`inline-flex items-center gap-1 font-medium ${selected ? 'text-[#a9583e]' : 'text-[#8e8b82]'}`}>
                  {selected ? 'Editing' : 'Configure'} <ChevronRight size={13} />
                </span>
              </div>
            </div>
            {(!isContentField(field) || field.conditions.length > 0 || hasValidationRules) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {!isContentField(field) && field.fieldType !== 'recaptcha' && (
                  <span className="inline-flex min-w-0 items-center rounded-full border border-[#ddd5cb] bg-[#f1ede7] px-2 py-1 font-medium text-[#6c6a64]">
                    <span className="truncate font-mono text-[11px]">
                      {field.bindVariable ? `{{${field.bindVariable}}}` : 'No variable'}
                    </span>
                  </span>
                )}
                {field.conditions.length > 0 && (
                  <span className="inline-flex flex-none items-center gap-1 rounded-full border border-[#d7c8e5] bg-[#f4eff9] px-2 py-1 font-medium text-[#6f4c87]">
                    <GitBranch size={12} aria-hidden="true" />
                    {field.conditions.length} logic {field.conditions.length === 1 ? 'rule' : 'rules'}
                  </span>
                )}
                {hasValidationRules && (
                  <span className="inline-flex flex-none items-center gap-1 rounded-full border border-[#e8cbbf] bg-[#fff2ec] px-2 py-1 font-medium text-[#a9583e]">
                    <ShieldCheck size={12} aria-hidden="true" />
                    Validation rules
                  </span>
                )}
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${field.label || 'untitled field'}`}
            title="Delete field"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-[#c64545] transition-colors hover:bg-[#fff3ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545]/40"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        {field.fieldType === 'content' && field.placeholder ? (
          <div className="px-4 pb-4">
            <div
              className="content-field-transparent rich-text-content max-h-40 overflow-hidden rounded-md border border-[#e6dfd8] bg-transparent p-3 text-sm leading-6 text-[#6c6a64]"
              dangerouslySetInnerHTML={{ __html: contentFieldHtml(field.placeholder) }}
            />
          </div>
        ) : showControlPreview ? (
          <div inert aria-hidden="true" className="px-4 pb-4">
            <FieldPreview field={toFieldConfig(field)} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
