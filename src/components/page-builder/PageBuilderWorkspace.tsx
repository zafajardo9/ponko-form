import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { savePageForm } from '../../lib/server-fns/page-forms'
import { addressRequiredParts } from '../../lib/page-builder/conditions'
import { richTextHtml } from '../form-builder/fields/FieldRenderer'
import type {
  ConditionAction,
  ConditionOperator,
  FieldCondition,
  PageFieldOption,
  FieldValidationRules,
  FormPage,
  PageField,
  PageFieldType,
} from '../../lib/page-builder/types'
import { Button } from '../ui/Button'
import {
  AlignJustify,
  MapPin,
  AtSign,
  Bold,
  Calendar,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  FileText,
  GripVertical,
  Heading1,
  Heading2,
  Hash,
  Image,
  Italic,
  List,
  ListOrdered,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  X,
} from 'lucide-react'

type FieldPaletteItem = {
  type: PageFieldType
  label: string
  icon: React.ReactNode
  preset?: 'terms'
}

const FIELD_ITEMS: FieldPaletteItem[] = [
  { type: 'text', label: 'Text', icon: <Type size={14} /> },
  { type: 'email', label: 'Email', icon: <AtSign size={14} /> },
  { type: 'number', label: 'Number', icon: <Hash size={14} /> },
  { type: 'textarea', label: 'Long Text', icon: <AlignJustify size={14} /> },
  { type: 'select', label: 'Dropdown', icon: <ChevronDown size={14} /> },
  { type: 'checkbox', label: 'Checkboxes', icon: <CheckSquare size={14} /> },
  { type: 'checkbox', label: 'Terms', icon: <ShieldCheck size={14} />, preset: 'terms' },
  { type: 'radio', label: 'Radio', icon: <CircleDot size={14} /> },
  { type: 'date', label: 'Date', icon: <Calendar size={14} /> },
  { type: 'time', label: 'Time', icon: <Clock size={14} /> },
  { type: 'datetime', label: 'Date & Time', icon: <CalendarClock size={14} /> },
  { type: 'address', label: 'Address', icon: <MapPin size={14} /> },
  { type: 'content', label: 'Details', icon: <FileText size={14} /> },
  { type: 'media', label: 'Media', icon: <Image size={14} /> },
]

function isContentField(field: Pick<PageField, 'fieldType'>) {
  return field.fieldType === 'content' || field.fieldType === 'media'
}

function mediaOption(field: PageField, key: 'type' | 'caption') {
  return field.options?.find((option) => option.label === key)?.value ?? ''
}

function setMediaOption(field: PageField, key: 'type' | 'caption', value: string) {
  const rest = (field.options ?? []).filter((option) => option.label !== key)
  return [...rest, { label: key, value }]
}

interface PageBuilderWorkspaceProps {
  formId: number
  pages: FormPage[]
  gateways: { id: number; name: string }[]
  onChanged: () => void
}

type Selection =
  | { type: 'page'; pageId: number }
  | { type: 'field'; fieldId: number }
  | null

type EditablePageField = PageField & { conditions: FieldCondition[] }
type EditablePage = FormPage & { fields: EditablePageField[] }

function sortPages(pages: FormPage[]): EditablePage[] {
  return pages
    .map((page) => ({
      ...page,
      fields: [...page.fields].sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position)
}

function snapshotPages(pages: EditablePage[]) {
  return JSON.stringify(
    pages.map((page, pageIndex) => ({
      title: page.title,
      description: page.description ?? null,
      position: pageIndex,
      isFinal: page.isFinal,
      finalTemplate: page.finalTemplate ?? null,
      finalRedirectUrl: page.finalRedirectUrl ?? null,
      hasPayment: page.hasPayment,
      paymentGatewayId: page.paymentGatewayId ?? null,
      paymentAmountVariable: page.paymentAmountVariable ?? null,
      paymentCurrency: page.paymentCurrency,
      paymentComputation: page.paymentComputation ?? null,
      fields: page.fields.map((field, fieldIndex) => ({
        fieldType: field.fieldType,
        label: field.label,
        placeholder: field.placeholder ?? null,
        required: field.required,
        options: field.options ?? null,
        bindVariable: field.bindVariable,
        position: fieldIndex,
        width: field.width,
        validationRules: field.validationRules ?? null,
        conditions: field.conditions.map((condition) => ({
          sourceFieldBinding: condition.sourceFieldBinding,
          operator: condition.operator,
          value: condition.value ?? null,
          action: condition.action,
        })),
      })),
    })),
  )
}

function tempId() {
  return -Math.floor(Date.now() + Math.random() * 100000)
}

function slugForBinding(input: string, used: Set<string>) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'field'
  let candidate = base
  let i = 2
  while (used.has(candidate)) {
    candidate = `${base}_${i}`
    i += 1
  }
  return candidate
}

function slugForOptionValue(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'option'
}

function optionValueForLabel(label: string, options: PageFieldOption[], index: number) {
  const base = slugForOptionValue(label) || `option_${index + 1}`
  const used = new Set(options.map((option, optionIndex) => (optionIndex === index ? '' : option.value)))
  let value = base
  let suffix = 2
  while (used.has(value)) {
    value = `${base}_${suffix}`
    suffix += 1
  }
  return value
}

export function PageBuilderWorkspace({
  formId,
  pages,
  gateways,
  onChanged,
}: PageBuilderWorkspaceProps) {
  const incomingPages = useMemo(() => sortPages(pages), [pages])
  const incomingSnapshot = useMemo(() => snapshotPages(incomingPages), [incomingPages])
  const [draftPages, setDraftPages] = useState<EditablePage[]>(incomingPages)
  const [savedSnapshot, setSavedSnapshot] = useState(incomingSnapshot)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [selectedPageId, setSelectedPageId] = useState(incomingPages[0]?.id ?? 0)
  const [selection, setSelection] = useState<Selection>(
    incomingPages[0] ? { type: 'page', pageId: incomingPages[0].id } : null,
  )
  const [settingsPanelWidth, setSettingsPanelWidth] = useState(360)
  const isResizingSettings = useRef(false)

  const currentSnapshot = useMemo(() => snapshotPages(draftPages), [draftPages])
  const isDirty = currentSnapshot !== savedSnapshot

  useEffect(() => {
    if (isDirty) return
    setDraftPages(incomingPages)
    setSavedSnapshot(incomingSnapshot)
    if (!incomingPages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(incomingPages[0]?.id ?? 0)
      setSelection(incomingPages[0] ? { type: 'page', pageId: incomingPages[0].id } : null)
    }
  }, [incomingPages, incomingSnapshot, isDirty, selectedPageId])

  useEffect(() => {
    if (!isDirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  const currentPage = draftPages.find((page) => page.id === selectedPageId) ?? draftPages[0]
  const selectedField =
    selection?.type === 'field'
      ? draftPages.flatMap((page) => page.fields).find((field) => field.id === selection.fieldId) ?? null
      : null
  const selectedPage =
    selection?.type === 'page'
      ? draftPages.find((page) => page.id === selection.pageId) ?? currentPage
      : currentPage

  const saveMutation = useMutation({
    mutationFn: () =>
      savePageForm({
        data: {
          formId,
          pages: draftPages.map((page, pageIndex) => ({
            ...page,
            position: pageIndex,
            fields: page.fields.map((field, fieldIndex) => ({
              ...field,
              position: fieldIndex,
              conditions: field.conditions.map((condition) => ({
                sourceFieldBinding: condition.sourceFieldBinding,
                operator: condition.operator,
                value: condition.value ?? null,
                action: condition.action,
              })),
            })),
          })),
        },
      }),
    onSuccess: (saved) => {
      const nextPages = sortPages(saved.pages)
      setDraftPages(nextPages)
      setSavedSnapshot(snapshotPages(nextPages))
      setSelectedPageId(nextPages[0]?.id ?? 0)
      setSelection(nextPages[0] ? { type: 'page', pageId: nextPages[0].id } : null)
      onChanged()
    },
  })

  function updatePageLocal(pageId: number, patch: Partial<FormPage>) {
    setDraftPages((items) =>
      items.map((page) => {
        if (page.id !== pageId) return patch.hasPayment ? { ...page, hasPayment: false } : page
        return { ...page, ...patch }
      }),
    )
  }

  function updateFieldLocal(fieldId: number, patch: Partial<PageField>) {
    setDraftPages((items) =>
      items.map((page) => ({
        ...page,
        fields: page.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
      })),
    )
  }

  function addPageLocal() {
    const finalPage = draftPages.find((page) => page.isFinal)
    const editablePages = draftPages.filter((page) => !page.isFinal)
    const page: EditablePage = {
      id: tempId(),
      formId,
      title: `Page ${editablePages.length + 1}`,
      description: null,
      position: editablePages.length,
      isFinal: false,
      finalTemplate: null,
      finalRedirectUrl: null,
      hasPayment: false,
      paymentGatewayId: null,
      paymentAmountVariable: null,
      paymentCurrency: 'USD',
      paymentComputation: null,
      fields: [],
    }
    const next = [...editablePages, page, ...(finalPage ? [finalPage] : [])].map((item, index) => ({
      ...item,
      position: index,
      isFinal: finalPage ? item.id === finalPage.id : index === editablePages.length + 1,
    }))
    setDraftPages(next)
    setSelectedPageId(page.id)
    setSelection({ type: 'page', pageId: page.id })
  }

  function deletePageLocal(pageId: number) {
    const page = draftPages.find((item) => item.id === pageId)
    if (!page || page.isFinal || draftPages.filter((item) => !item.isFinal).length <= 1) return
    const next = draftPages.filter((item) => item.id !== pageId).map((item, index) => ({
      ...item,
      position: index,
      isFinal: index === draftPages.length - 2,
    }))
    setDraftPages(next)
    setSelectedPageId(next[0]?.id ?? 0)
    setSelection(next[0] ? { type: 'page', pageId: next[0].id } : null)
  }

  function addFieldLocal(item: FieldPaletteItem) {
    if (!currentPage || currentPage.isFinal) return
    const fieldType = item.type
    const isTerms = item.preset === 'terms'
    const used = new Set(draftPages.flatMap((page) => page.fields.map((field) => field.bindVariable)))
    const field: EditablePageField = {
      id: tempId(),
      pageId: currentPage.id,
      fieldType,
      label: isTerms
        ? 'Terms and Conditions'
        : fieldType === 'content'
          ? 'Details'
          : fieldType === 'media'
            ? 'Media'
            : fieldType === 'address'
              ? 'Address'
              : '',
      placeholder: fieldType === 'content' ? '<p>Add helpful details for this page.</p>' : null,
      required: isTerms,
      options: isTerms
        ? [
            {
              label: 'I agree to the terms and conditions.',
              value: 'accepted',
            },
          ]
        : fieldType === 'media'
        ? [
            { label: 'type', value: 'image' },
            { label: 'caption', value: '' },
          ]
        : ['select', 'checkbox', 'radio'].includes(fieldType)
        ? [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ]
        : null,
      bindVariable: slugForBinding(isTerms ? 'terms_and_conditions' : fieldType, used),
      position: currentPage.fields.length,
      width: 'full',
      validationRules: null,
      conditions: [],
    }
    setDraftPages((items) =>
      items.map((page) =>
        page.id === currentPage.id ? { ...page, fields: [...page.fields, field] } : page,
      ),
    )
    setSelection({ type: 'field', fieldId: field.id })
  }

  function deleteFieldLocal(fieldId: number) {
    setDraftPages((items) =>
      items.map((page) => ({
        ...page,
        fields: page.fields
          .filter((field) => field.id !== fieldId)
          .map((field, index) => ({ ...field, position: index })),
      })),
    )
    if (currentPage) setSelection({ type: 'page', pageId: currentPage.id })
  }

  function moveFieldToPageLocal(fieldId: number, targetPageId: number) {
    setDraftPages((items) => {
      const sourcePage = items.find((page) => page.fields.some((field) => field.id === fieldId))
      const targetPage = items.find((page) => page.id === targetPageId)
      const field = sourcePage?.fields.find((item) => item.id === fieldId)
      if (!sourcePage || !targetPage || !field || targetPage.isFinal) return items
      if (sourcePage.id === targetPage.id) return items

      return items.map((page) => {
        if (page.id === sourcePage.id) {
          return {
            ...page,
            fields: page.fields
              .filter((item) => item.id !== fieldId)
              .map((item, index) => ({ ...item, position: index })),
          }
        }

        if (page.id === targetPage.id) {
          return {
            ...page,
            fields: [
              ...page.fields,
              { ...field, pageId: targetPage.id, position: page.fields.length },
            ].map((item, index) => ({ ...item, position: index })),
          }
        }

        return page
      })
    })
    setSelectedPageId(targetPageId)
    setSelection({ type: 'field', fieldId })
  }

  function saveConditionsLocal(fieldId: number, conditions: FieldCondition[]) {
    setDraftPages((items) =>
      items.map((page) => ({
        ...page,
        fields: page.fields.map((field) =>
          field.id === fieldId ? { ...field, conditions } : field,
        ),
      })),
    )
  }

  function handlePageDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const nonFinal = draftPages.filter((page) => !page.isFinal)
    const finalPage = draftPages.find((page) => page.isFinal)
    const oldIndex = nonFinal.findIndex((page) => page.id === active.id)
    const newIndex = nonFinal.findIndex((page) => page.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = [...arrayMove(nonFinal, oldIndex, newIndex), ...(finalPage ? [finalPage] : [])]
    setDraftPages(next.map((page, index) => ({ ...page, position: index, isFinal: page.id === finalPage?.id })))
  }

  function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!currentPage || !over || active.id === over.id) return
    const oldIndex = currentPage.fields.findIndex((field) => field.id === active.id)
    const newIndex = currentPage.fields.findIndex((field) => field.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const nextFields = arrayMove(currentPage.fields, oldIndex, newIndex).map((field, index) => ({
      ...field,
      position: index,
    }))
    setDraftPages((items) =>
      items.map((page) => (page.id === currentPage.id ? { ...page, fields: nextFields } : page)),
    )
  }

  if (!currentPage) {
    return <div className="flex flex-1 items-center justify-center text-sm text-[#8e8b82]">No pages yet.</div>
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <aside className="flex-none border-b border-[#e6dfd8] bg-[#faf9f5] p-4 lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase text-[#8e8b82]">Fields</p>
          <span className={`text-xs ${isDirty ? 'text-[#cc785c]' : 'text-[#2f7d52]'}`}>
            {isDirty ? 'Unsaved' : 'Saved'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {FIELD_ITEMS.map((item) => (
            <button
              key={`${item.type}-${item.preset ?? item.label}`}
              disabled={currentPage.isFinal}
              onClick={() => addFieldLocal(item)}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5 text-left text-sm transition-colors hover:border-[#cc785c] hover:bg-[#efe9de] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[#efe9de] text-[#cc785c]">
                {item.icon}
              </span>
              <span className="truncate text-[#141413]">{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-h-[520px] flex-1 flex-col overflow-hidden bg-[#f5f0e8]">
        <div className="flex items-center gap-2 border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-3">
          <div className="flex flex-1 gap-2 overflow-x-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePageDragEnd}>
              <SortableContext
                items={draftPages.filter((page) => !page.isFinal).map((page) => page.id)}
                strategy={horizontalListSortingStrategy}
              >
                {draftPages.map((page) => (
                  <SortablePageTab
                    key={page.id}
                    page={page}
                    active={page.id === currentPage.id}
                    onSelect={() => {
                      setSelectedPageId(page.id)
                      setSelection({ type: 'page', pageId: page.id })
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              onClick={addPageLocal}
              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md border border-[#e6dfd8] bg-[#f5f0e8] text-[#6c6a64] hover:bg-[#efe9de] hover:text-[#141413]"
              aria-label="Add page"
              title="Add page"
            >
              <Plus size={15} />
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!isDirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="flex-none"
          >
            {saveMutation.isPending ? (
              'Saving...'
            ) : isDirty ? (
              <span className="inline-flex items-center gap-1.5"><Save size={14} /> Save</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Check size={14} /> Saved</span>
            )}
          </Button>
        </div>
        {saveMutation.error && (
          <div className="border-b border-[#f0c2b8] bg-[#fff3ef] px-4 py-2 text-sm text-[#c64545]">
            {(saveMutation.error as Error).message}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-medium text-[#141413]">{currentPage.title}</h2>
                {currentPage.description && <p className="mt-1 text-sm text-[#6c6a64]">{currentPage.description}</p>}
              </div>
              {!currentPage.isFinal && (
                <p className="text-xs text-[#8e8b82]">Drag tabs or field cards to reorder.</p>
              )}
            </div>

            {currentPage.isFinal ? (
              <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-6 text-center">
                <div className="mb-3 text-4xl">✓</div>
                <p className="whitespace-pre-wrap text-[#3d3d3a]">
                  {currentPage.finalTemplate || 'Your response has been recorded.'}
                </p>
              </div>
            ) : currentPage.fields.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-lg border-2 border-dashed border-[#e6dfd8] bg-[#faf9f5] text-sm text-[#8e8b82]">
                Add fields from the left panel.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
                  <SortableContext
                    items={currentPage.fields.map((item) => item.id)}
                    strategy={rectSortingStrategy}
                  >
                    {currentPage.fields.map((field) => (
                      <SortableFieldCard
                        key={field.id}
                        field={field}
                        pages={draftPages}
                        selected={selectedField?.id === field.id}
                        onSelect={() => setSelection({ type: 'field', fieldId: field.id })}
                        onMoveToPage={(pageId) => moveFieldToPageLocal(field.id, pageId)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      </main>

      <aside
        className="relative flex-none border-t border-[#e6dfd8] bg-[#faf9f5] lg:overflow-y-auto lg:border-l lg:border-t-0"
        style={{ width: `min(100%, ${settingsPanelWidth}px)` }}
      >
        <div
          onMouseDown={(event) => {
            event.preventDefault()
            isResizingSettings.current = true
            const startX = event.clientX
            const startWidth = settingsPanelWidth

            function onMouseMove(moveEvent: MouseEvent) {
              if (!isResizingSettings.current) return
              const nextWidth = startWidth - (moveEvent.clientX - startX)
              setSettingsPanelWidth(Math.max(300, Math.min(720, nextWidth)))
            }

            function onMouseUp() {
              isResizingSettings.current = false
              document.removeEventListener('mousemove', onMouseMove)
              document.removeEventListener('mouseup', onMouseUp)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
            }

            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          className="absolute left-0 top-0 z-10 hidden h-full w-1.5 cursor-col-resize transition-colors hover:bg-[#cc785c]/30 active:bg-[#cc785c]/50 lg:block"
          aria-hidden="true"
        />
        <div className="p-4">
          {selectedField ? (
            <FieldSettings
              field={selectedField}
              pages={draftPages}
              fields={draftPages.flatMap((page) => page.fields)}
              onUpdate={(patch) => updateFieldLocal(selectedField.id, patch)}
              onMoveToPage={(pageId) => moveFieldToPageLocal(selectedField.id, pageId)}
              onDelete={() => deleteFieldLocal(selectedField.id)}
              onSaveConditions={(conditions) => saveConditionsLocal(selectedField.id, conditions)}
            />
          ) : (
            <PageSettings
              page={selectedPage}
              gateways={gateways}
              fields={draftPages.flatMap((page) => page.fields)}
              onUpdate={(patch) => updatePageLocal(selectedPage.id, patch)}
              onDelete={() => deletePageLocal(selectedPage.id)}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

interface PageSettingsProps {
  page: FormPage
  gateways: { id: number; name: string }[]
  fields: PageField[]
  onUpdate: (patch: Partial<FormPage>) => void
  onDelete: () => void
}

function PageSettings({ page, gateways, fields, onUpdate, onDelete }: PageSettingsProps) {
  const pricedOptionFields = fields.filter((field) =>
    ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
    field.validationRules?.optionPricesEnabled &&
    field.options?.some((option) => Number(option.price ?? 0) > 0),
  )
  const numberFields = fields.filter((field) => field.fieldType === 'number')
  const paymentComputation = page.paymentComputation ?? {
    mode: page.paymentAmountVariable ? 'field' : 'sum_priced_options',
    fieldBindings: page.paymentAmountVariable ? [page.paymentAmountVariable] : [],
    fixedAmount: null,
  }

  function updatePaymentComputation(patch: Partial<NonNullable<FormPage['paymentComputation']>>) {
    const next = { ...paymentComputation, ...patch } as NonNullable<FormPage['paymentComputation']>
    onUpdate({
      paymentComputation: next,
      paymentAmountVariable: next.mode === 'field' ? next.fieldBindings?.[0] ?? null : null,
    })
  }

  function togglePaymentBinding(binding: string, checked: boolean) {
    const current = new Set(paymentComputation.fieldBindings ?? [])
    if (checked) current.add(binding)
    else current.delete(binding)
    updatePaymentComputation({ fieldBindings: [...current] })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase text-[#8e8b82]">
          {page.isFinal ? 'Final page' : 'Page settings'}
        </p>
        <h3 className="mt-1 text-lg font-medium text-[#141413]">{page.title}</h3>
      </div>

      <Field label="Title">
        <input value={page.title} onChange={(e) => onUpdate({ title: e.target.value })} className={inputClass} />
      </Field>

      {!page.isFinal && (
        <Field label="Description">
          <textarea
            value={page.description ?? ''}
            onChange={(e) => onUpdate({ description: e.target.value || null })}
            rows={3}
            className={`${inputClass} h-auto resize-none`}
          />
        </Field>
      )}

      {page.isFinal ? (
        <>
          <Field label="Template">
            <textarea
              value={page.finalTemplate ?? ''}
              onChange={(e) => onUpdate({ finalTemplate: e.target.value })}
              rows={6}
              className={`${inputClass} h-auto resize-none`}
            />
          </Field>
          <Field label="Redirect URL">
            <input
              value={page.finalRedirectUrl ?? ''}
              onChange={(e) => onUpdate({ finalRedirectUrl: e.target.value || null })}
              className={inputClass}
              placeholder="https://example.com/thanks"
            />
          </Field>
        </>
      ) : (
        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
          <label className="flex items-center gap-2 text-sm text-[#141413]">
            <input
              type="checkbox"
              checked={page.hasPayment}
              onChange={(e) => onUpdate({ hasPayment: e.target.checked })}
              className="h-4 w-4 accent-[#cc785c]"
            />
            Payment page
          </label>
          {page.hasPayment && (
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Gateway">
                <select
                  value={page.paymentGatewayId ?? ''}
                  onChange={(e) => onUpdate({ paymentGatewayId: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                >
                  <option value="">Visitor chooses connected gateway</option>
                  {gateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="rounded-lg border border-[#e6dfd8] bg-white p-3">
                <p className="text-sm font-medium text-[#141413]">Payment computation</p>
                <div className="mt-3 flex flex-col gap-3">
                  <Field label="Amount mode">
                    <select
                      value={paymentComputation.mode}
                      onChange={(e) => {
                        const mode = e.target.value as NonNullable<FormPage['paymentComputation']>['mode']
                        updatePaymentComputation({
                          mode,
                          fieldBindings: mode === 'field'
                            ? [page.paymentAmountVariable ?? numberFields[0]?.bindVariable ?? ''].filter(Boolean)
                            : mode === 'sum_priced_options'
                              ? pricedOptionFields.map((field) => field.bindVariable)
                              : mode === 'sum_number_fields'
                                ? numberFields.map((field) => field.bindVariable)
                            : [],
                          fixedAmount: mode === 'fixed' ? paymentComputation.fixedAmount ?? 0 : null,
                        })
                      }}
                      className={inputClass}
                    >
                      <option value="sum_priced_options">Sum selected option prices</option>
                      <option value="sum_number_fields">Sum number fields</option>
                      <option value="field">Use one amount field</option>
                      <option value="fixed">Fixed amount</option>
                    </select>
                  </Field>

                  {paymentComputation.mode === 'field' && (
                    <Field label="Amount field">
                      <select
                        value={paymentComputation.fieldBindings?.[0] ?? ''}
                        onChange={(e) => updatePaymentComputation({ fieldBindings: e.target.value ? [e.target.value] : [] })}
                        className={inputClass}
                      >
                        <option value="">Select amount field...</option>
                        {numberFields.map((field) => (
                          <option key={field.id} value={field.bindVariable}>
                            {field.label || field.bindVariable}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {paymentComputation.mode === 'fixed' && (
                    <Field label="Fixed amount">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={paymentComputation.fixedAmount ?? ''}
                        onChange={(e) => updatePaymentComputation({ fixedAmount: e.target.value === '' ? null : Number(e.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                  )}

                  {paymentComputation.mode === 'sum_priced_options' && (
                    <PaymentFieldChecklist
                      fields={pricedOptionFields}
                      selected={paymentComputation.fieldBindings ?? []}
                      emptyText="No priced option fields yet. Enable option prices on a checkbox, radio, or dropdown field first."
                      onToggle={togglePaymentBinding}
                    />
                  )}

                  {paymentComputation.mode === 'sum_number_fields' && (
                    <PaymentFieldChecklist
                      fields={numberFields}
                      selected={paymentComputation.fieldBindings ?? []}
                      emptyText="No number fields yet."
                      onToggle={togglePaymentBinding}
                    />
                  )}
                </div>
              </div>
              <Field label="Currency">
                <input
                  value={page.paymentCurrency}
                  onChange={(e) => onUpdate({ paymentCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {!page.isFinal && (
        <Button type="button" variant="danger" onClick={onDelete}>
          Delete Page
        </Button>
      )}
    </div>
  )
}

function PaymentFieldChecklist({
  fields,
  selected,
  emptyText,
  onToggle,
}: {
  fields: PageField[]
  selected: string[]
  emptyText: string
  onToggle: (binding: string, checked: boolean) => void
}) {
  if (fields.length === 0) {
    return <p className="rounded-md bg-[#faf9f5] p-3 text-sm text-[#8e8b82]">{emptyText}</p>
  }

  const selectedSet = new Set(selected)
  return (
    <div className="rounded-md border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <p className="mb-2 text-xs font-medium uppercase text-[#8e8b82]">Include fields</p>
      <div className="flex flex-col gap-2">
        {fields.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-sm text-[#3d3d3a]">
            <input
              type="checkbox"
              checked={selectedSet.has(field.bindVariable)}
              onChange={(e) => onToggle(field.bindVariable, e.target.checked)}
              className="h-4 w-4 accent-[#cc785c]"
            />
            {field.label || field.bindVariable}
          </label>
        ))}
      </div>
    </div>
  )
}

interface SortablePageTabProps {
  page: FormPage
  active: boolean
  onSelect: () => void
}

function SortablePageTab({ page, active, onSelect }: SortablePageTabProps) {
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
  pages: FormPage[]
  selected: boolean
  onSelect: () => void
  onMoveToPage: (pageId: number) => void
}

function SortableFieldCard({ field, pages, selected, onSelect, onMoveToPage }: SortableFieldCardProps) {
  const [moveOpen, setMoveOpen] = useState(false)
  const moveMenuRef = useRef<HTMLDivElement | null>(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })
  const destinationPages = pages.filter((page) => !page.isFinal && page.id !== field.pageId)

  useEffect(() => {
    if (!moveOpen) return

    function onPointerDown(event: PointerEvent) {
      if (moveMenuRef.current?.contains(event.target as Node)) return
      setMoveOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoveOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [moveOpen])

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
      <div className="min-w-0 flex-1 p-4 text-left">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onSelect} className="min-w-0 text-left">
            <p className="truncate text-sm font-medium text-[#141413]">
              {field.label || 'Untitled field'}
              {field.required && <span className="text-[#c64545]"> *</span>}
            </p>
          </button>
          <div className="flex flex-none items-center gap-2">
            <span className="rounded bg-[#efe9de] px-2 py-0.5 text-xs text-[#6c6a64]">
              {field.fieldType}
            </span>
            <div ref={moveMenuRef} className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMoveOpen((open) => !open)
                }}
                disabled={destinationPages.length === 0}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e6dfd8] bg-white px-2 text-xs font-medium text-[#6c6a64] transition-colors hover:border-[#cc785c] hover:text-[#141413] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Move <ChevronDown size={12} />
              </button>
              {moveOpen && (
                <div className="absolute right-0 top-8 z-20 w-48 overflow-hidden rounded-md border border-[#e6dfd8] bg-white py-1 text-sm shadow-lg">
                  {destinationPages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onMoveToPage(page.id)
                        setMoveOpen(false)
                      }}
                      className="block w-full truncate px-3 py-2 text-left text-[#3d3d3a] hover:bg-[#f5f0e8] hover:text-[#141413]"
                    >
                      {page.title || `Page ${page.position + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <button type="button" onClick={onSelect} className="mt-2 block w-full min-w-0 text-left">
          <p className="truncate text-xs text-[#8e8b82]">
            {field.bindVariable ? `{{${field.bindVariable}}}` : 'No binding'}
            {field.conditions.length > 0 ? ` · ${field.conditions.length} condition(s)` : ''}
          </p>
        </button>
        {field.fieldType === 'content' && field.placeholder && (
          <button type="button" onClick={onSelect} className="mt-3 block w-full text-left">
            <div
              className="rich-text-content max-h-40 overflow-hidden rounded-md border border-[#e6dfd8] bg-white p-3 text-sm leading-6 text-[#6c6a64]"
              dangerouslySetInnerHTML={{ __html: richTextHtml(field.placeholder) }}
            />
          </button>
        )}
      </div>
    </div>
  )
}

interface FieldSettingsProps {
  field: EditablePageField
  pages: FormPage[]
  fields: PageField[]
  onUpdate: (patch: Partial<PageField>) => void
  onMoveToPage: (pageId: number) => void
  onDelete: () => void
  onSaveConditions: (conditions: FieldCondition[]) => void
}

function FieldSettings({ field, pages, fields, onUpdate, onMoveToPage, onDelete, onSaveConditions }: FieldSettingsProps) {
  const [conditions, setConditions] = useState(field.conditions)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [logicOpen, setLogicOpen] = useState(false)
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase text-[#8e8b82]">Field settings</p>
        <h3 className="mt-1 text-lg font-medium text-[#141413]">{field.label || 'Untitled field'}</h3>
      </div>

      <Field label="Label">
        <input value={field.label} onChange={(e) => onUpdate({ label: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Type">
        <select value={field.fieldType} onChange={(e) => onUpdate({ fieldType: e.target.value as PageFieldType })} className={inputClass}>
          {FIELD_ITEMS.filter((item) => !item.preset).map((item) => (
            <option key={item.type} value={item.type}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Move to page">
        <select value={field.pageId} onChange={(e) => onMoveToPage(Number(e.target.value))} className={inputClass}>
          {editablePages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title || `Page ${page.position + 1}`}
            </option>
          ))}
        </select>
      </Field>

      {field.fieldType === 'content' ? (
        <FieldGroup label="Body">
          <RichTextEditor
            value={field.placeholder ?? ''}
            onChange={(html) => onUpdate({ placeholder: html || null })}
          />
        </FieldGroup>
      ) : field.fieldType === 'media' ? (
        <>
          <Field label="Media URL">
            <input
              value={field.placeholder ?? ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value || null })}
              className={inputClass}
              placeholder="https://example.com/image.jpg"
            />
          </Field>
          <Field label="Media type">
            <select
              value={mediaOption(field, 'type') || 'image'}
              onChange={(e) => onUpdate({ options: setMediaOption(field, 'type', e.target.value) })}
              className={inputClass}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="embed">Embed</option>
            </select>
          </Field>
          <Field label="Caption">
            <input
              value={mediaOption(field, 'caption')}
              onChange={(e) => onUpdate({ options: setMediaOption(field, 'caption', e.target.value) })}
              className={inputClass}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Placeholder">
            <input value={field.placeholder ?? ''} onChange={(e) => onUpdate({ placeholder: e.target.value || null })} className={inputClass} />
          </Field>
          <Field label="Binding">
            <input value={field.bindVariable} onChange={(e) => onUpdate({ bindVariable: e.target.value })} className={inputClass} />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!isContentField(field) && (
          <label className="flex items-center gap-2 text-sm text-[#141413]">
            <input type="checkbox" checked={field.required} onChange={(e) => onUpdate({ required: e.target.checked })} className="h-4 w-4 accent-[#cc785c]" />
            Required
          </label>
        )}
        <Field label="Width">
          <select value={field.width} onChange={(e) => onUpdate({ width: e.target.value as 'full' | 'half' })} className={inputClass}>
            <option value="full">Full</option>
            <option value="half">Half</option>
          </select>
        </Field>
      </div>

      {field.fieldType === 'address' && (
        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
          <p className="text-sm font-medium text-[#141413]">Required address parts</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {[
              ['currentAddress', 'Current Address'],
              ['apartment', 'Apartment'],
              ['city', 'City'],
              ['stateProvince', 'State/Province'],
              ['zipPostalCode', 'ZIP/Postal Code'],
              ['country', 'Country'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-[#3d3d3a]">
                <input
                  type="checkbox"
                  checked={addressRequired[key as keyof typeof addressRequired]}
                  onChange={(e) =>
                    updateRules({
                      addressRequired: {
                        ...addressRequired,
                        [key]: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4 accent-[#cc785c]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {['select', 'checkbox', 'radio'].includes(field.fieldType) && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 text-sm text-[#141413]">
            <input
              type="checkbox"
              checked={Boolean(rules.optionPricesEnabled)}
              onChange={(e) => updateRules({ optionPricesEnabled: e.target.checked ? true : null })}
              className="h-4 w-4 accent-[#cc785c]"
            />
            Use option prices for payment
          </label>
          <OptionsEditor
            options={field.options ?? []}
            showPrices={Boolean(rules.optionPricesEnabled)}
            onChange={(options) => onUpdate({ options })}
          />
        </div>
      )}

      {!isContentField(field) && (
        <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 text-left transition-colors hover:border-[#cc785c]/70 hover:bg-[#efe9de]"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#141413]">Rules</span>
            <span className="rounded bg-white px-2 py-0.5 text-xs text-[#6c6a64]">
              {field.validationRules ? 'Configured' : 'None'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8e8b82]">Allowed characters, lengths, ranges, and messages.</p>
        </button>

        <button
          type="button"
          onClick={() => setLogicOpen(true)}
          className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 text-left transition-colors hover:border-[#cc785c]/70 hover:bg-[#efe9de]"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#141413]">Logic</span>
            <span className="rounded bg-white px-2 py-0.5 text-xs text-[#6c6a64]">
              {conditions.length} {conditions.length === 1 ? 'rule' : 'rules'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#8e8b82]">Show or hide this field when another field matches.</p>
        </button>
        </div>
      )}

      <Button type="button" variant="danger" onClick={onDelete}>
        Delete Field
      </Button>

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

      {logicOpen && (
        <LogicDialog
          field={field}
          fields={fields}
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

function FieldDialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-[#f5f0e8] shadow-xl">
        <div className="flex items-center justify-between rounded-t-xl border-b border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <div>
            <p className="text-xs font-medium uppercase text-[#8e8b82]">{subtitle}</p>
            <h2 className="mt-1 text-lg font-medium text-[#141413]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end rounded-b-xl border-t border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

function OptionsEditor({
  options,
  showPrices,
  onChange,
}: {
  options: PageFieldOption[]
  showPrices: boolean
  onChange: (options: PageFieldOption[]) => void
}) {
  function updateOption(index: number, patch: Partial<PageFieldOption>) {
    const next = options.map((option, optionIndex) => {
      if (optionIndex !== index) return option
      const updated = { ...option, ...patch }
      if (patch.label != null && patch.value == null) {
        updated.value = optionValueForLabel(patch.label, options, index)
      }
      return updated
    })
    onChange(next)
  }

  function addOption() {
    const label = `Option ${options.length + 1}`
    onChange([...options, { label, value: optionValueForLabel(label, options, options.length), price: showPrices ? 0 : null }])
  }

  function removeOption(index: number) {
    onChange(options.filter((_, optionIndex) => optionIndex !== index))
  }

  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#141413]">Options</p>
          <p className="mt-0.5 text-xs text-[#8e8b82]">
            Labels are shown to respondents. Values are used by logic and submissions.
            {showPrices ? ' Prices can be used by payment totals.' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={addOption}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white px-2.5 text-xs font-medium text-[#3d3d3a] hover:border-[#cc785c] hover:text-[#141413]"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      <div className={`grid ${showPrices ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'} gap-2 px-1 pb-1 text-xs font-medium uppercase text-[#8e8b82]`}>
        <span>Label</span>
        <span>Value</span>
        {showPrices && <span>Price</span>}
        <span className="sr-only">Remove</span>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={index} className={`grid ${showPrices ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'} gap-2`}>
            <input
              value={option.label}
              onChange={(e) => updateOption(index, { label: e.target.value })}
              className={inputClass}
            />
            <input
              value={option.value}
              onChange={(e) => updateOption(index, { value: slugForOptionValue(e.target.value) })}
              className={inputClass}
            />
            {showPrices && (
              <input
                type="number"
                min={0}
                step="0.01"
                value={option.price ?? ''}
                onChange={(e) => updateOption(index, { price: e.target.value === '' ? null : Number(e.target.value) })}
                className={inputClass}
              />
            )}
            <button
              type="button"
              onClick={() => removeOption(index)}
              disabled={options.length <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-md text-[#c64545] hover:bg-[#fff3ef] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Remove ${option.label || 'option'}`}
              title="Remove option"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function RulesDialog({
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

function LogicDialog({
  field,
  fields,
  conditions,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: {
  field: EditablePageField
  fields: PageField[]
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
            const sourceOptions = ['select', 'checkbox', 'radio'].includes(sourceField?.fieldType ?? '')
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
                      {fields.filter((item) => item.id !== field.id).map((item) => (
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
                      <input
                        value={condition.value ?? ''}
                        onChange={(e) => onUpdate(index, { value: e.target.value })}
                        disabled={valueDisabled}
                        className={inputClass}
                      />
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

const inputClass =
  'h-10 w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20'

function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const [, setEditorVersion] = useState(0)
  const lastEditorHtmlRef = useRef(value || '<p></p>')
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'rich-text-content min-h-40 rounded-b-md bg-[#faf9f5] px-3 py-3 text-sm leading-6 text-[#141413] outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastEditorHtmlRef.current = html
      onChange(html)
      setEditorVersion((version) => version + 1)
    },
    onSelectionUpdate: () => {
      setEditorVersion((version) => version + 1)
    },
    onTransaction: () => {
      setEditorVersion((version) => version + 1)
    },
  })

  useEffect(() => {
    if (!editor) return
    const nextValue = value || '<p></p>'
    if (nextValue === lastEditorHtmlRef.current) return
    if (editor.getHTML() !== nextValue) {
      lastEditorHtmlRef.current = nextValue
      editor.commands.setContent(nextValue, { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) {
    return <div className="h-48 rounded-md border border-[#e6dfd8] bg-[#faf9f5]" />
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#e6dfd8] focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/20">
      <div className="flex flex-wrap gap-1 border-b border-[#e6dfd8] bg-white p-1.5">
        <ToolbarButton active={editor.isActive('bold')} label="Bold" onPress={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} label="Italic" onPress={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} label="Underline" onPress={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 1 })} label="Heading 1" onPress={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} label="Heading 2" onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} label="Bullet list" onPress={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} label="Numbered list" onPress={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="rich-text-editor" />
    </div>
  )
}

function ToolbarButton({
  active,
  label,
  onPress,
  children,
}: {
  active: boolean
  label: string
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault()
        onPress()
      }}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-[#cc785c] text-white' : 'text-[#6c6a64] hover:bg-[#efe9de] hover:text-[#141413]'
      }`}
    >
      {children}
    </button>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#141413]">{label}</span>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#141413]">{label}</span>
      {children}
    </label>
  )
}
