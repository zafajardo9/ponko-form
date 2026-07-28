import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical, Upload } from 'lucide-react'
import type { FormPage, PageField } from '../../lib/page-builder/types'
import { richTextHtml } from '../form-builder/fields/FieldRenderer'
import { StarIcon } from '../ui/StarIcon'
import { SVG_STAR_MARKER } from '../../lib/page-builder/satisfaction'
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
}

export function SortableFieldCard({ field, selected, onSelect }: SortableFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })
  const paletteItem = fieldPaletteItem(field.fieldType)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex min-w-0 rounded-lg border bg-[#faf9f5] text-left transition-colors ${
        selected ? 'border-[#cc785c] shadow-sm' : 'border-[#e6dfd8] hover:border-[#cc785c]/60'
      } ${field.width === 'full' ? 'sm:col-span-2' : ''} ${isDragging ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex w-9 flex-none items-center justify-center border-r border-[#e6dfd8] text-[#8e8b82] hover:bg-[#efe9de] hover:text-[#141413]"
        aria-label={`Reorder ${field.label || 'field'}`}
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c]/30">
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
        {!isContentField(field) && field.fieldType !== 'recaptcha' && (
          <p className="mt-2 truncate text-xs text-[#8e8b82]">
            Saves to {field.bindVariable ? `{{${field.bindVariable}}}` : 'no variable'}
            {field.conditions.length > 0 ? ` · ${field.conditions.length} logic ${field.conditions.length === 1 ? 'rule' : 'rules'}` : ''}
          </p>
        )}
        {field.fieldType === 'content' && field.placeholder && (
          <div className="mt-3 block w-full text-left">
            <div
              className="rich-text-content max-h-40 overflow-hidden rounded-md border border-[#e6dfd8] bg-white p-3 text-sm leading-6 text-[#6c6a64]"
              dangerouslySetInnerHTML={{ __html: richTextHtml(field.placeholder) }}
            />
          </div>
        )}
        {field.fieldType === 'file_upload' && (
          <div className="mt-3 block w-full text-left">
            <div className="flex items-center gap-3 rounded-md border border-dashed border-[#d8cec3] bg-white p-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#efe9de] text-[#cc785c]">
                <Upload size={15} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#141413]">Drop files or browse</p>
                <p className="truncate text-xs text-[#8e8b82]">{field.placeholder || 'Respondents can upload a file.'}</p>
              </div>
            </div>
          </div>
        )}
        {field.fieldType === 'satisfaction' && (
          <div className="mt-3 block w-full text-left">
            {(field.options?.length ?? 0) > 0 && (field.options ?? []).every((option) => option.emoji === SVG_STAR_MARKER) ? (
              <div className="inline-flex items-center gap-1 rounded-lg border border-[#e6dfd8] bg-white px-3 py-2.5 text-[#cc785c]">
                {(field.options ?? []).map((option) => (
                  <StarIcon key={option.value} size={24} filled={false} className="h-6 w-6" />
                ))}
                <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-[#8e8b82]">Star rating</span>
              </div>
            ) : (
              <div className="flex gap-1.5 overflow-hidden">
                {(field.options ?? []).map((option) => (
                <span key={option.value} className="flex min-w-0 flex-1 flex-col items-center rounded-md border border-[#e6dfd8] bg-white px-1 py-2">
                  <span className="text-lg leading-none">{option.emoji || option.value}</span>
                  <span className="mt-1 max-w-full truncate text-[10px] text-[#8e8b82]">{option.label}</span>
                </span>
                ))}
              </div>
            )}
          </div>
        )}
        {field.fieldType === 'recaptcha' && (
          <div className="mt-3 block w-full text-left">
            <div className="flex h-[70px] max-w-[304px] items-center gap-3 rounded border border-[#d8d8d8] bg-white px-4 text-sm text-[#3d3d3a]">
              <span className="h-7 w-7 rounded border-2 border-[#777]" />
              <span>I’m not a robot</span>
              <span className="ml-auto text-[10px] text-[#777]">reCAPTCHA</span>
            </div>
          </div>
        )}
      </button>
    </div>
  )
}
