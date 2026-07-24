import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useMutation } from '@tanstack/react-query'
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
import {
  savePageForm,
  type SavedPageForm,
} from '../../lib/server-fns/page-forms'
import { addressRequiredParts } from '../../lib/page-builder/conditions'
import {
  buildReferenceMap,
  calculateFieldComputation,
} from '../../lib/page-builder/references'
import { richTextHtml } from '../form-builder/fields/FieldRenderer'
import {
  inferSatisfactionPreset,
  satisfactionOptions,
  SVG_STAR_MARKER,
  type SatisfactionPreset,
} from '../../lib/page-builder/satisfaction'
import type {
  ConditionAction,
  ConditionOperator,
  FieldCondition,
  FieldComputation,
  FormulaOperator,
  FormulaTermSource,
  PageFieldOption,
  FieldValidationRules,
  FormReference,
  FormReferenceType,
  FormPage,
  PageField,
  PageFieldType,
  SubscriptionIntervalPreset,
} from '../../lib/page-builder/types'
import { Button } from '../ui/Button'
import { StarIcon } from '../ui/StarIcon'
import {
  AlignJustify,
  MapPin,
  AtSign,
  Calendar,
  CalendarClock,
  Calculator,
  Check,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  CircleDot,
  Clock,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Hash,
  Image,
  Info,
  LayoutGrid,
  List,
  ListPlus,
  Plus,
  Search,
  SlidersHorizontal,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Smile,
  Trash2,
  Type,
  Variable,
  Upload,
  X,
} from 'lucide-react'

const RichTextEditor = lazy(() => import('./RichTextEditor'))

type FieldPaletteItem = {
  type: PageFieldType
  label: string
  description: string
  category: 'Questions' | 'Choices' | 'Date & time' | 'Content' | 'Advanced'
  icon: React.ReactNode
  preset?: 'terms'
}

const FIELD_ITEMS: FieldPaletteItem[] = [
  { type: 'text', label: 'Short text', description: 'A single-line written answer.', category: 'Questions', icon: <Type size={14} /> },
  { type: 'email', label: 'Email', description: 'An email address with validation.', category: 'Questions', icon: <AtSign size={14} /> },
  { type: 'number', label: 'Number', description: 'A numeric answer you can calculate with.', category: 'Questions', icon: <Hash size={14} /> },
  { type: 'textarea', label: 'Long text', description: 'A multi-line written answer.', category: 'Questions', icon: <AlignJustify size={14} /> },
  { type: 'address', label: 'Address', description: 'A structured postal address.', category: 'Questions', icon: <MapPin size={14} /> },
  { type: 'file_upload', label: 'File upload', description: 'One or more uploaded files.', category: 'Questions', icon: <Upload size={14} /> },
  { type: 'select', label: 'Dropdown', description: 'Choose one option from a compact menu.', category: 'Choices', icon: <ChevronDown size={14} /> },
  { type: 'checkbox', label: 'Checkboxes', description: 'Choose one or more options.', category: 'Choices', icon: <CheckSquare size={14} /> },
  { type: 'checkbox', label: 'Terms', description: 'A required agreement checkbox.', category: 'Choices', icon: <ShieldCheck size={14} />, preset: 'terms' },
  { type: 'radio', label: 'Single choice', description: 'Choose exactly one visible option.', category: 'Choices', icon: <CircleDot size={14} /> },
  { type: 'satisfaction', label: 'Rating', description: 'Stars, satisfaction, or NPS scale.', category: 'Choices', icon: <Smile size={14} /> },
  { type: 'date', label: 'Date', description: 'A calendar date.', category: 'Date & time', icon: <Calendar size={14} /> },
  { type: 'time', label: 'Time', description: 'A time of day.', category: 'Date & time', icon: <Clock size={14} /> },
  { type: 'datetime', label: 'Date and time', description: 'A calendar date and time.', category: 'Date & time', icon: <CalendarClock size={14} /> },
  { type: 'content', label: 'Instructions', description: 'Formatted text that does not collect an answer.', category: 'Content', icon: <FileText size={14} /> },
  { type: 'media', label: 'Media', description: 'An image, video, or embedded resource.', category: 'Content', icon: <Image size={14} /> },
  { type: 'computation', label: 'Calculated value', description: 'A total or formula built from other answers.', category: 'Advanced', icon: <Calculator size={14} /> },
  { type: 'recaptcha', label: 'Spam protection', description: 'Google reCAPTCHA verification.', category: 'Advanced', icon: <ShieldCheck size={14} /> },
]

const FIELD_CATEGORIES: FieldPaletteItem['category'][] = [
  'Questions',
  'Choices',
  'Date & time',
  'Content',
  'Advanced',
]

function fieldPaletteItem(type: PageFieldType) {
  return FIELD_ITEMS.find((item) => item.type === type && !item.preset) ?? FIELD_ITEMS[0]
}

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

function fieldOption(field: PageField, key: string) {
  return field.options?.find((option) => option.label === key)?.value ?? ''
}

function setFieldOption(field: PageField, key: string, value: string) {
  const rest = (field.options ?? []).filter((option) => option.label !== key)
  return [...rest, { label: key, value }]
}

interface PageBuilderWorkspaceProps {
  formId: number
  pages: FormPage[]
  references: FormReference[]
  gateways: { id: number; name: string; slug: string }[]
  onChanged: (saved: SavedPageForm) => void
  onDraftChange?: (draft: { pages: FormPage[]; references: FormReference[] }) => void
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

function sortReferences(references: FormReference[]) {
  return [...references].sort((a, b) => a.position - b.position)
}

function snapshotBuilder(pages: EditablePage[], references: FormReference[]) {
  return JSON.stringify(
    {
      references: references.map((reference, index) => ({
        key: reference.key,
        type: reference.type,
        value: reference.value,
        label: reference.label ?? null,
        description: reference.description ?? null,
        position: index,
      })),
      pages: pages.map((page, pageIndex) => ({
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
        subscriptionConfig: page.subscriptionConfig ?? null,
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
    },
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

function variableToken(name: string) {
  return `{{${name}}}`
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
  references,
  gateways,
  onChanged,
  onDraftChange,
}: PageBuilderWorkspaceProps) {
  const incomingPages = useMemo(() => sortPages(pages), [pages])
  const incomingReferences = useMemo(() => sortReferences(references), [references])
  const incomingSnapshot = useMemo(
    () => snapshotBuilder(incomingPages, incomingReferences),
    [incomingPages, incomingReferences],
  )
  const [draftPages, setDraftPages] = useState<EditablePage[]>(incomingPages)
  const [draftReferences, setDraftReferences] = useState<FormReference[]>(incomingReferences)
  const [savedSnapshot, setSavedSnapshot] = useState(incomingSnapshot)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [selectedPageId, setSelectedPageId] = useState(incomingPages[0]?.id ?? 0)
  const [selection, setSelection] = useState<Selection>(
    incomingPages[0] ? { type: 'page', pageId: incomingPages[0].id } : null,
  )
  const [settingsPanelWidth, setSettingsPanelWidth] = useState(400)
  const [panelMode, setPanelMode] = useState<'settings' | 'references'>('settings')
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [fieldSearch, setFieldSearch] = useState('')
  const [paletteView, setPaletteView] = useState<'list' | 'grid'>('list')
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const isResizingSettings = useRef(false)

  const currentSnapshot = useMemo(() => snapshotBuilder(draftPages, draftReferences), [draftPages, draftReferences])
  const isDirty = currentSnapshot !== savedSnapshot

  useEffect(() => {
    onDraftChange?.({ pages: draftPages, references: draftReferences })
  }, [draftPages, draftReferences, onDraftChange])

  useEffect(() => {
    if (isDirty) return
    setDraftPages(incomingPages)
    setDraftReferences(incomingReferences)
    setSavedSnapshot(incomingSnapshot)
    if (!incomingPages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(incomingPages[0]?.id ?? 0)
      setSelection(incomingPages[0] ? { type: 'page', pageId: incomingPages[0].id } : null)
    }
  }, [incomingPages, incomingReferences, incomingSnapshot, isDirty, selectedPageId])

  useEffect(() => {
    if (!isDirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (!mobileSettingsOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileSettingsOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileSettingsOpen])

  const currentPage = draftPages.find((page) => page.id === selectedPageId) ?? draftPages[0]
  const selectedField =
    selection?.type === 'field'
      ? draftPages.flatMap((page) => page.fields).find((field) => field.id === selection.fieldId) ?? null
      : null
  const selectedPage =
    selection?.type === 'page'
      ? draftPages.find((page) => page.id === selection.pageId) ?? currentPage
      : currentPage
  const filteredFieldItems = useMemo(() => {
    const query = fieldSearch.trim().toLowerCase()
    if (!query) return FIELD_ITEMS
    return FIELD_ITEMS.filter((item) =>
      [
        item.label,
        item.description,
        item.category,
        item.type.replaceAll('_', ' '),
      ].some((value) => value.toLowerCase().includes(query)),
    )
  }, [fieldSearch])

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
          references: draftReferences.map((reference, index) => ({
            id: reference.id,
            key: reference.key,
            type: reference.type,
            value: reference.value,
            label: reference.label,
            description: reference.description,
            position: index,
          })),
        },
      }),
    onSuccess: (saved) => {
      const nextPages = sortPages(saved.pages)
      const nextReferences = sortReferences(saved.references ?? [])
      const previousPageIndex = draftPages.findIndex((page) => page.id === selectedPageId)
      const previousFieldBinding = selection?.type === 'field'
        ? draftPages.flatMap((page) => page.fields).find((field) => field.id === selection.fieldId)?.bindVariable
        : null
      const nextField = previousFieldBinding
        ? nextPages.flatMap((page) => page.fields).find((field) => field.bindVariable === previousFieldBinding)
        : null
      const nextFieldPage = nextField
        ? nextPages.find((page) => page.fields.some((field) => field.id === nextField.id))
        : null
      const nextPage = nextFieldPage ?? nextPages[Math.max(0, previousPageIndex)] ?? nextPages[0]
      setDraftPages(nextPages)
      setDraftReferences(nextReferences)
      setSavedSnapshot(snapshotBuilder(nextPages, nextReferences))
      setSelectedPageId(nextPage?.id ?? 0)
      setSelection(
        nextField
          ? { type: 'field', fieldId: nextField.id }
          : nextPage
            ? { type: 'page', pageId: nextPage.id }
            : null,
      )
      onChanged(saved)
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
      subscriptionConfig: null,
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
    setMobileSettingsOpen(false)
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
    setMobileSettingsOpen(false)
  }

  function addFieldLocal(item: FieldPaletteItem) {
    if (!currentPage || currentPage.isFinal) return
    const fieldType = item.type
    const isTerms = item.preset === 'terms'
    const used = new Set([
      ...draftPages.flatMap((page) => page.fields.map((field) => field.bindVariable)),
      ...draftReferences.map((reference) => reference.key),
    ])
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
              : fieldType === 'file_upload'
                ? 'File upload'
              : fieldType === 'computation'
                ? 'Total'
              : fieldType === 'satisfaction'
                ? 'How satisfied are you?'
              : fieldType === 'recaptcha'
                ? ''
              : '',
      placeholder: fieldType === 'content'
        ? '<p>Add helpful details for this page.</p>'
        : fieldType === 'computation'
          ? 'Calculated from selected fields.'
          : fieldType === 'file_upload'
            ? 'Upload an image or file.'
          : null,
      required: (isTerms || fieldType === 'file_upload' || fieldType === 'recaptcha') && fieldType !== 'computation',
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
        : fieldType === 'file_upload'
        ? [
            { label: 'accept', value: 'any' },
            { label: 'acceptCustom', value: '' },
            { label: 'multiple', value: 'false' },
          ]
        : fieldType === 'satisfaction'
        ? satisfactionOptions('five-point')
        : ['select', 'checkbox', 'radio'].includes(fieldType)
        ? [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ]
        : null,
      bindVariable: slugForBinding(isTerms ? 'terms_and_conditions' : fieldType, used),
      position: currentPage.fields.length,
      width: 'full',
      validationRules: fieldType === 'computation'
        ? {
            computation: {
              mode: 'expression',
              editorMode: 'visual',
              outputMode: 'number',
              numericType: 'automatic',
              terms: [],
              showBreakdown: true,
            },
          }
        : null,
      conditions: [],
    }
    setDraftPages((items) =>
      items.map((page) =>
        page.id === currentPage.id ? { ...page, fields: [...page.fields, field] } : page,
      ),
    )
    setPanelMode('settings')
    setSelection({ type: 'field', fieldId: field.id })
    setMobilePaletteOpen(false)
    setMobileSettingsOpen(true)
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
    setMobileSettingsOpen(false)
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
      <aside className="flex-none border-b border-[#e6dfd8] bg-[#faf9f5] p-4 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#141413]">Add a field</p>
          <div className="flex flex-none items-center gap-3">
            <span className={`text-xs ${isDirty ? 'text-[#cc785c]' : 'text-[#2f7d52]'}`}>
              {isDirty ? 'Unsaved' : 'Saved'}
            </span>
            <button
              type="button"
              aria-expanded={mobilePaletteOpen}
              onClick={() => setMobilePaletteOpen((open) => !open)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white px-2.5 text-xs font-medium text-[#3d3d3a] lg:hidden"
            >
              {mobilePaletteOpen ? 'Hide fields' : 'Browse field types'}
              <ChevronDown size={13} className={`transition-transform ${mobilePaletteOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <div className={`${mobilePaletteOpen ? 'mt-4 flex' : 'hidden'} flex-col lg:mt-4 lg:flex`}>
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search field types</span>
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8b82]"
              />
              <input
                type="search"
                value={fieldSearch}
                onChange={(event) => setFieldSearch(event.target.value)}
                placeholder="Search fields"
                className="h-9 w-full rounded-lg border border-[#ddd5cc] bg-white pl-8 pr-8 text-sm text-[#141413] outline-none transition-colors placeholder:text-[#9b9790] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
              />
              {fieldSearch ? (
                <button
                  type="button"
                  onClick={() => setFieldSearch('')}
                  aria-label="Clear field search"
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#8e8b82] transition-colors hover:bg-[#efe9de] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div
              role="group"
              aria-label="Field display"
              className="flex flex-none rounded-lg border border-[#ddd5cc] bg-[#f3eee6] p-0.5"
            >
              <button
                type="button"
                aria-label="List view"
                aria-pressed={paletteView === 'list'}
                title="List view"
                onClick={() => setPaletteView('list')}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                  paletteView === 'list'
                    ? 'bg-white text-[#b45f45] shadow-sm'
                    : 'text-[#817d76] hover:text-[#141413]'
                }`}
              >
                <List size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={paletteView === 'grid'}
                title="Compact grid view"
                onClick={() => setPaletteView('grid')}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                  paletteView === 'grid'
                    ? 'bg-white text-[#b45f45] shadow-sm'
                    : 'text-[#817d76] hover:text-[#141413]'
                }`}
              >
                <LayoutGrid size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <p role="status" aria-label="Field search results" className="sr-only">
            {filteredFieldItems.length === FIELD_ITEMS.length
              ? `${FIELD_ITEMS.length} field types available`
              : `${filteredFieldItems.length} field types found`}
          </p>

          {filteredFieldItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#d8cec3] bg-white px-4 py-6 text-center">
              <Search size={18} aria-hidden="true" className="mx-auto text-[#b3aaa1]" />
              <p className="mt-2 text-sm font-medium text-[#3d3d3a]">No matching fields</p>
              <p className="mt-1 text-xs leading-5 text-[#817d76]">
                Try a field name like email, rating, or date.
              </p>
              <button
                type="button"
                onClick={() => setFieldSearch('')}
                className="mt-3 text-xs font-medium text-[#b45f45] hover:text-[#8f4634] focus-visible:outline-none focus-visible:underline"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className={`mt-4 flex flex-col ${paletteView === 'grid' ? 'gap-4' : 'gap-5'}`}>
              {FIELD_CATEGORIES.map((category) => {
                const categoryItems = filteredFieldItems.filter((item) => item.category === category)
                if (categoryItems.length === 0) return null
                const categoryId = `field-category-${category.replaceAll(' ', '-').toLowerCase()}`

                return (
                  <section key={category} aria-labelledby={categoryId}>
                    <p
                      id={categoryId}
                      className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#8e8b82]"
                    >
                      {category}
                    </p>
                    <div
                      className={
                        paletteView === 'grid'
                          ? 'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3'
                          : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1'
                      }
                    >
                      {categoryItems.map((item) => (
                        <button
                          key={`${item.type}-${item.preset ?? item.label}`}
                          type="button"
                          disabled={currentPage.isFinal}
                          onClick={() => addFieldLocal(item)}
                          title={item.description}
                          className={`group min-w-0 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] text-sm transition-colors hover:border-[#cc785c] hover:bg-[#efe9de] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                            paletteView === 'grid'
                              ? 'flex min-h-[74px] flex-col items-center justify-center gap-1.5 px-1.5 py-2 text-center'
                              : 'flex items-center gap-2 px-3 py-2.5 text-left'
                          }`}
                        >
                          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-[#efe9de] text-[#cc785c] transition-colors group-hover:bg-white">
                            {item.icon}
                          </span>
                          <span
                            className={
                              paletteView === 'grid'
                                ? 'line-clamp-2 text-[11px] font-medium leading-4 text-[#3d3d3a]'
                                : 'truncate text-[#141413]'
                            }
                          >
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
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
                      setPanelMode('settings')
                      setSelection({ type: 'page', pageId: page.id })
                      setMobileSettingsOpen(false)
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
              <span className="inline-flex items-center gap-1.5"><Save size={14} /> Save changes</span>
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
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e6dfd8] bg-[#faf9f5] px-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efe9de] text-[#cc785c]">
                  <Plus size={18} />
                </span>
                <p className="mt-3 text-sm font-medium text-[#141413]">This page has no fields yet</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-[#8e8b82]">Choose a field type from the Add a field panel. It will appear here and open its settings.</p>
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
                        selected={selectedField?.id === field.id}
                        onSelect={() => {
                          setPanelMode('settings')
                          setSelection({ type: 'field', fieldId: field.id })
                          setMobileSettingsOpen(true)
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      </main>

      {mobileSettingsOpen && (
        <button
          type="button"
          aria-label="Close field settings"
          onClick={() => setMobileSettingsOpen(false)}
          className="fixed inset-0 z-40 bg-[#141413]/35 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        aria-label="Settings panel"
        className={`w-full flex-none border-t border-[#e6dfd8] bg-[#faf9f5] lg:relative lg:z-auto lg:max-h-none lg:w-[min(100%,var(--settings-panel-width))] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:rounded-none lg:shadow-none ${
          mobileSettingsOpen
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-t-2xl shadow-[0_-16px_48px_rgba(20,20,19,0.18)]'
            : 'relative'
        }`}
        style={{ '--settings-panel-width': `${settingsPanelWidth}px` } as CSSProperties}
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
              setSettingsPanelWidth(Math.max(340, Math.min(720, nextWidth)))
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
        {mobileSettingsOpen && (
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#e6dfd8] bg-[#faf9f5]/95 px-4 pb-3 pt-2 backdrop-blur lg:hidden">
            <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[#d8cec3]" />
            <div className="min-w-0 flex-1 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[#8e8b82]">Field settings</p>
              <p className="truncate text-sm font-medium text-[#141413]">
                {selectedField?.label || 'Untitled field'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
              className="mt-2 inline-flex h-9 flex-none items-center justify-center rounded-md bg-[#cc785c] px-3 text-xs font-medium text-white transition-colors hover:bg-[#a9583e] disabled:bg-[#e6dfd8] disabled:text-[#8e8b82]"
            >
              {saveMutation.isPending ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
            </button>
            <button
              type="button"
              onClick={() => setMobileSettingsOpen(false)}
              className="mt-2 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[#e6dfd8] bg-white text-[#6c6a64] transition-colors hover:border-[#cc785c] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
              aria-label="Close field settings"
            >
              <X size={17} />
            </button>
          </div>
        )}
        <div className="p-4">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-1 text-sm">
            <button
              type="button"
              onClick={() => setPanelMode('settings')}
              className={`rounded-md px-3 py-1.5 ${panelMode === 'settings' ? 'bg-white font-medium text-[#141413] shadow-sm' : 'text-[#6c6a64] hover:text-[#141413]'}`}
            >
              Configure
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('references')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 ${panelMode === 'references' ? 'bg-white font-medium text-[#141413] shadow-sm' : 'text-[#6c6a64] hover:text-[#141413]'}`}
            >
              <SlidersHorizontal size={13} /> References
            </button>
          </div>

          {panelMode === 'references' ? (
            <ReferencesPanel
              formId={formId}
              references={draftReferences}
              fields={draftPages.flatMap((page) => page.fields)}
              onChange={setDraftReferences}
            />
          ) : selectedField ? (
            <FieldSettings
              field={selectedField}
              pages={draftPages}
              fields={draftPages.flatMap((page) => page.fields)}
              references={draftReferences}
              onUpdate={(patch) => updateFieldLocal(selectedField.id, patch)}
              onMoveToPage={(pageId) => moveFieldToPageLocal(selectedField.id, pageId)}
              onDelete={() => deleteFieldLocal(selectedField.id)}
              onSaveConditions={(conditions) => saveConditionsLocal(selectedField.id, conditions)}
            />
          ) : (
            <PageSettings
              page={selectedPage}
              gateways={gateways}
              pages={draftPages}
              references={draftReferences}
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
  gateways: { id: number; name: string; slug: string }[]
  pages: FormPage[]
  references: FormReference[]
  onUpdate: (patch: Partial<FormPage>) => void
  onDelete: () => void
}

function referenceValueForType(type: FormReferenceType, value: string) {
  if (type === 'boolean') return value === 'true' ? 'true' : 'false'
  if (type === 'percentage') {
    const cleaned = value.replace('%', '').trim()
    return cleaned.endsWith('%') ? cleaned : `${cleaned || '0'}%`
  }
  return value
}

function ReferencesPanel({
  formId,
  references,
  fields,
  onChange,
}: {
  formId: number
  references: FormReference[]
  fields: PageField[]
  onChange: (references: FormReference[]) => void
}) {
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState({
    key: '',
    type: 'number' as FormReferenceType,
    value: '0',
    label: '',
    description: '',
  })
  const fieldBindings = new Set(fields.map((field) => field.bindVariable))

  function startNew() {
    const used = new Set([...references.map((reference) => reference.key), ...fieldBindings])
    const key = slugForBinding('reference', used)
    setDraft({ key, type: 'number', value: '0', label: '', description: '' })
    setEditingId('new')
  }

  function startEdit(reference: FormReference) {
    setDraft({
      key: reference.key,
      type: reference.type,
      value: reference.type === 'percentage' ? reference.value.replace('%', '').trim() : reference.value,
      label: reference.label ?? '',
      description: reference.description ?? '',
    })
    setEditingId(reference.id)
  }

  function save() {
    const nextReference: FormReference = {
      id: editingId === 'new' ? tempId() : editingId as number,
      formId,
      key: draft.key,
      type: draft.type,
      value: referenceValueForType(draft.type, draft.value),
      label: draft.label || null,
      description: draft.description || null,
      position: editingId === 'new' ? references.length : references.findIndex((reference) => reference.id === editingId),
    }
    if (editingId === 'new') onChange([...references, nextReference])
    else onChange(references.map((reference) => (reference.id === editingId ? nextReference : reference)))
    setEditingId(null)
  }
  const duplicateKey = references.some((reference) => reference.id !== editingId && reference.key === draft.key)
  const bindingCollision = fieldBindings.has(draft.key)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-[#8e8b82]">References</p>
          <h3 className="mt-1 text-lg font-medium text-[#141413]">Reference variables</h3>
        </div>
        <Button type="button" size="sm" onClick={startNew}>
          Add
        </Button>
      </div>

      {(duplicateKey || bindingCollision) && editingId && (
        <p className="rounded-lg border border-[#f0c2b8] bg-[#fff3ef] p-3 text-sm text-[#c64545]">
          {bindingCollision ? 'This key is already used as a field binding.' : 'This key is already used by another reference.'}
        </p>
      )}

      {editingId && (
        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Key">
              <input
                value={draft.key}
                onChange={(e) => setDraft((item) => ({ ...item, key: slugForOptionValue(e.target.value) }))}
                className={inputClass}
              />
            </Field>
            <Field label="Type">
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft((item) => ({
                    ...item,
                    type: e.target.value as FormReferenceType,
                    value: e.target.value === 'boolean'
                      ? 'false'
                      : e.target.value === 'number'
                        ? '0'
                        : e.target.value === 'percentage'
                          ? '12'
                          : '',
                  }))
                }
                className={inputClass}
              >
                <option value="number">Number</option>
                <option value="percentage">Percentage</option>
                <option value="text">Text</option>
                <option value="boolean">Boolean</option>
              </select>
            </Field>
            <Field label="Value">
              {draft.type === 'boolean' ? (
                <select
                  value={draft.value}
                  onChange={(e) => setDraft((item) => ({ ...item, value: e.target.value }))}
                  className={inputClass}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
                </select>
              ) : (
                <div className="relative">
                  <input
                    type={draft.type === 'number' || draft.type === 'percentage' ? 'number' : 'text'}
                    step={draft.type === 'number' || draft.type === 'percentage' ? '0.01' : undefined}
                    value={draft.value}
                    onChange={(e) => setDraft((item) => ({ ...item, value: e.target.value }))}
                    className={`${inputClass} ${draft.type === 'percentage' ? 'pr-10' : ''}`}
                    placeholder={draft.type === 'percentage' ? '12' : undefined}
                  />
                  {draft.type === 'percentage' && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8e8b82]">
                      %
                    </span>
                  )}
                </div>
              )}
            </Field>
            <Field label="Label">
              <input
                value={draft.label}
                onChange={(e) => setDraft((item) => ({ ...item, label: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((item) => ({ ...item, description: e.target.value }))}
                rows={3}
                className={`${inputClass} h-auto resize-none`}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={save} disabled={duplicateKey || bindingCollision || !draft.key}>
                Save Reference
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {references.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e6dfd8] bg-[#faf9f5] p-6 text-sm text-[#8e8b82]">
          Add prices, fees, VAT rates, and thresholds once, then reference them in options, payments, and logic.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {references.map((reference) => (
            <div key={reference.id} className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#141413]">{reference.label || reference.key}</p>
                  <p className="mt-0.5 text-xs text-[#8e8b82]">
                    {`{{${reference.key}}}`} · {reference.type} · {reference.value}
                  </p>
                  {reference.description && <p className="mt-2 text-xs text-[#6c6a64]">{reference.description}</p>}
                </div>
                <div className="flex flex-none gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(reference)}
                    className="rounded-md px-2 py-1 text-xs text-[#6c6a64] hover:bg-white hover:text-[#141413]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(references.filter((item) => item.id !== reference.id))}
                    className="rounded-md px-2 py-1 text-xs text-[#c64545] hover:bg-[#fff3ef]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PageSettings({ page, gateways, pages, references, onUpdate, onDelete }: PageSettingsProps) {
  const numberReferences = references.filter((reference) => reference.type === 'number' || reference.type === 'percentage')
  const availablePaymentFields = pages
    .filter((candidate) => candidate.position <= page.position && !candidate.isFinal)
    .flatMap((candidate) => candidate.fields)
  const pricedOptionFields = availablePaymentFields.filter((field) =>
    ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
    field.validationRules?.optionPricesEnabled &&
    field.options?.some((option) =>
      Number(option.price ?? 0) > 0 ||
      Number(option.additionalPrice ?? 0) > 0 ||
      Boolean(option.priceReference) ||
      Boolean(option.additionalPriceReference),
    ),
  )
  const numberFields = availablePaymentFields.filter((field) =>
    field.fieldType === 'number' ||
    (field.fieldType === 'computation' && field.validationRules?.computation?.outputMode !== 'text'),
  )
  const earlierFields = pages
    .filter((candidate) => candidate.position < page.position)
    .flatMap((candidate) => candidate.fields)
  const customerNameFields = earlierFields.filter((field) => ['text', 'textarea'].includes(field.fieldType))
  const customerEmailFields = earlierFields.filter((field) => field.fieldType === 'email')
  const xenditGateway = gateways.find((gateway) => gateway.slug === 'xendit')
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
                  disabled={Boolean(page.subscriptionConfig)}
                >
                  {!page.subscriptionConfig && <option value="">Visitor chooses connected gateway</option>}
                  {gateways.filter((gateway) => !page.subscriptionConfig || gateway.slug === 'xendit').map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Payment mode">
                <select
                  value={page.subscriptionConfig ? 'subscription' : 'one_time'}
                  onChange={(event) => {
                    if (event.target.value === 'one_time') {
                      onUpdate({ subscriptionConfig: null })
                      return
                    }
                    onUpdate({
                      paymentGatewayId: xenditGateway?.id ?? null,
                      paymentCurrency: 'PHP',
                      subscriptionConfig: {
                        enabled: true,
                        interval: 'monthly',
                        intervalUnit: 'MONTH',
                        intervalCount: 1,
                        trialPeriodDays: 0,
                        maxCycles: null,
                        customerNameField: customerNameFields[0]?.bindVariable ?? '',
                        customerEmailField: customerEmailFields[0]?.bindVariable ?? '',
                      },
                    })
                  }}
                  className={inputClass}
                >
                  <option value="one_time">One-time payment</option>
                  <option value="subscription">Subscription</option>
                </select>
              </Field>
              {page.subscriptionConfig && (
                <div className="rounded-lg border border-[#e6dfd8] bg-white p-3">
                  <p className="text-sm font-medium text-[#141413]">Subscription schedule</p>
                  {!xenditGateway && (
                    <p className="mt-2 text-xs text-[#a9583e]">Xendit must be active before this form can be saved.</p>
                  )}
                  <div className="mt-3 flex flex-col gap-3">
                    <Field label="Billing interval">
                      <select
                        value={page.subscriptionConfig.interval}
                        onChange={(event) => {
                          const interval = event.target.value as SubscriptionIntervalPreset
                          const mapping = {
                            weekly: { intervalUnit: 'WEEK' as const, intervalCount: 1 },
                            monthly: { intervalUnit: 'MONTH' as const, intervalCount: 1 },
                            quarterly: { intervalUnit: 'MONTH' as const, intervalCount: 3 },
                            semiannual: { intervalUnit: 'MONTH' as const, intervalCount: 6 },
                            annual: { intervalUnit: 'MONTH' as const, intervalCount: 12 },
                          }[interval]
                          onUpdate({ subscriptionConfig: { ...page.subscriptionConfig!, interval, ...mapping } })
                        }}
                        className={inputClass}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semiannual">Semiannual</option>
                        <option value="annual">Annual</option>
                      </select>
                    </Field>
                    <Field label="Customer name field">
                      <select
                        value={page.subscriptionConfig.customerNameField}
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...page.subscriptionConfig!, customerNameField: event.target.value,
                        } })}
                        className={inputClass}
                      >
                        <option value="">Select an earlier name field...</option>
                        {customerNameFields.map((field) => <option key={field.id} value={field.bindVariable}>{field.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Customer email field">
                      <select
                        value={page.subscriptionConfig.customerEmailField}
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...page.subscriptionConfig!, customerEmailField: event.target.value,
                        } })}
                        className={inputClass}
                      >
                        <option value="">Select an earlier email field...</option>
                        {customerEmailFields.map((field) => <option key={field.id} value={field.bindVariable}>{field.label}</option>)}
                      </select>
                    </Field>
                    {(customerNameFields.length === 0 || customerEmailFields.length === 0) && (
                      <p className="text-xs leading-relaxed text-[#a9583e]">
                        Add required Name (text) and Email fields on a page before this payment page.
                      </p>
                    )}
                    <Field label="Trial period (days)">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={page.subscriptionConfig.trialPeriodDays}
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...page.subscriptionConfig!, trialPeriodDays: Math.max(0, Number(event.target.value) || 0),
                        } })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Maximum billing cycles">
                      <input
                        type="number"
                        min={1}
                        max={32000}
                        value={page.subscriptionConfig.maxCycles ?? ''}
                        placeholder="No limit"
                        onChange={(event) => onUpdate({ subscriptionConfig: {
                          ...page.subscriptionConfig!,
                          maxCycles: event.target.value === '' ? null : Math.max(1, Number(event.target.value) || 1),
                        } })}
                        className={inputClass}
                      />
                    </Field>
                    <p className="text-xs leading-relaxed text-[#8e8b82]">
                      Editing this schedule affects new subscribers only. Existing plans continue with their original schedule.
                    </p>
                  </div>
                </div>
              )}
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
                            : mode === 'sum_priced_options' || mode === 'formula'
                              ? pricedOptionFields.map((field) => field.bindVariable)
                              : mode === 'sum_number_fields'
                                ? numberFields.map((field) => field.bindVariable)
                            : [],
                          fixedAmount: mode === 'fixed' ? paymentComputation.fixedAmount ?? 0 : null,
                          adjustments: mode === 'formula' ? paymentComputation.adjustments ?? [] : [],
                        })
                      }}
                      className={inputClass}
                    >
                      <option value="sum_priced_options">Sum selected option prices</option>
                      <option value="sum_number_fields">Sum number fields</option>
                      <option value="formula">Formula builder</option>
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
                            {field.label || field.bindVariable} {`{{${field.bindVariable}}}`}
                          </option>
                        ))}
                      </select>
                      {numberFields.length === 0 && (
                        <p className="mt-1 text-xs leading-relaxed text-[#a9583e]">
                          Add a number field or a numeric calculation on this page or an earlier page.
                        </p>
                      )}
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

                  {paymentComputation.mode === 'formula' && (
                    <>
                      <PaymentFieldChecklist
                        fields={pricedOptionFields}
                        selected={paymentComputation.fieldBindings ?? []}
                        emptyText="No priced option fields yet. Enable option prices on a checkbox, radio, or dropdown field first."
                        onToggle={togglePaymentBinding}
                      />
                      <FormulaAdjustmentsEditor
                        references={numberReferences}
                        adjustments={paymentComputation.adjustments ?? []}
                        onChange={(adjustments) => updatePaymentComputation({ adjustments })}
                      />
                    </>
                  )}
                </div>
              </div>
              <Field label="Currency">
                <input
                  value={page.paymentCurrency}
                  onChange={(e) => onUpdate({ paymentCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                  className={inputClass}
                  disabled={Boolean(page.subscriptionConfig)}
                />
              </Field>
              <label className="flex items-center gap-2 rounded-lg border border-[#e6dfd8] bg-white p-3 text-sm text-[#141413]">
                <input
                  type="checkbox"
                  checked={Boolean(paymentComputation.showBreakdown)}
                  onChange={(e) => updatePaymentComputation({ showBreakdown: e.target.checked })}
                  className="h-4 w-4 accent-[#cc785c]"
                />
                Show price breakdown before payment
              </label>
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

function FormulaAdjustmentsEditor({
  references,
  adjustments,
  onChange,
}: {
  references: FormReference[]
  adjustments: NonNullable<FormPage['paymentComputation']>['adjustments']
  onChange: (adjustments: NonNullable<FormPage['paymentComputation']>['adjustments']) => void
}) {
  const items = adjustments ?? []

  function update(index: number, patch: Partial<{ type: 'add' | 'subtract' | 'multiply'; referenceKey: string }>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function add() {
    const referenceKey = references[0]?.key ?? ''
    onChange([...items, { type: 'add', referenceKey }])
  }

  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#141413]">Formula adjustments</p>
          <p className="mt-0.5 text-xs text-[#8e8b82]">Apply fees, discounts, VAT, or multipliers from number and percentage references.</p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={references.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white px-2.5 text-xs font-medium text-[#3d3d3a] hover:border-[#cc785c] hover:text-[#141413] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={13} /> Add
        </button>
      </div>
      {references.length === 0 ? (
        <p className="text-sm text-[#8e8b82]">Create a number or percentage reference first.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#8e8b82]">No adjustments yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={`${item.referenceKey}-${index}`} className="grid grid-cols-[120px_minmax(0,1fr)_auto] gap-2">
              <select
                value={item.type}
                onChange={(e) => update(index, { type: e.target.value as 'add' | 'subtract' | 'multiply' })}
                className={inputClass}
              >
                <option value="add">+ Add</option>
                <option value="subtract">- Subtract</option>
                <option value="multiply">+ Percent</option>
              </select>
              <select
                value={item.referenceKey}
                onChange={(e) => update(index, { referenceKey: e.target.value })}
                className={inputClass}
              >
                {references.map((reference) => (
                  <option key={reference.id} value={reference.key}>
                    {reference.label || reference.key} = {reference.value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="flex h-10 w-10 items-center justify-center rounded-md text-[#c64545] hover:bg-[#fff3ef]"
                title="Remove adjustment"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formulaToken(label: string, tone: 'source' | 'reference' | 'operator' | 'total' = 'source', key?: string) {
  const toneClass = {
    source: 'border-[#e6dfd8] bg-white text-[#141413]',
    reference: 'border-[#d8c8b7] bg-[#fff8ef] text-[#7a4b35]',
    operator: 'border-transparent bg-transparent px-0 text-[#8e8b82]',
    total: 'border-[#cc785c] bg-[#fff3ef] text-[#9d4f38]',
  }[tone]
  return (
    <span key={key ?? `${tone}-${label}`} className={`inline-flex min-h-8 items-center rounded-md border px-2.5 text-sm font-medium ${toneClass}`}>
      {label}
    </span>
  )
}

function FormulaPreview({
  sourceFields,
  selectedBindings,
  adjustments,
  references,
}: {
  sourceFields: PageField[]
  selectedBindings: string[]
  adjustments: FieldComputation['adjustments']
  references: FormReference[]
}) {
  const selected = selectedBindings.length > 0
    ? sourceFields.filter((field) => selectedBindings.includes(field.bindVariable))
    : sourceFields
  const referencesByKey = new Map(references.map((reference) => [reference.key, reference]))
  const sourceLabel = selected.length === 0
    ? 'selected items'
    : selected.length === 1
      ? selected[0].label || selected[0].bindVariable
      : `${selected.length} selected fields`

  return (
    <div className="rounded-xl border border-[#e6dfd8] bg-white p-4">
      <p className="mb-3 text-xs font-medium uppercase text-[#8e8b82]">Formula</p>
      <div className="flex flex-wrap items-center gap-2">
        {formulaToken('Total', 'total', 'total')}
        {formulaToken('=', 'operator', 'equals')}
        {formulaToken(sourceLabel, 'source', 'source')}
        {(adjustments ?? []).map((adjustment, index) => {
          const reference = referencesByKey.get(adjustment.referenceKey)
          const label = reference?.label || reference?.key || adjustment.referenceKey || 'reference'
          if (adjustment.type === 'multiply') {
            return (
              <span key={`${adjustment.referenceKey}-${index}`} className="contents">
                {formulaToken('+', 'operator', `operator-${index}`)}
                {formulaToken(`(${index === 0 ? 'subtotal' : 'running total'} x ${label})`, 'reference', `reference-${index}`)}
              </span>
            )
          }
          return (
            <span key={`${adjustment.referenceKey}-${index}`} className="contents">
              {formulaToken(adjustment.type === 'subtract' ? '-' : '+', 'operator', `operator-${index}`)}
              {formulaToken(label, 'reference', `reference-${index}`)}
            </span>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-[#8e8b82]">
        Percent references such as VAT are added as a percentage of the current running total.
      </p>
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
  selected: boolean
  onSelect: () => void
}

function SortableFieldCard({ field, selected, onSelect }: SortableFieldCardProps) {
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

interface FieldSettingsProps {
  field: EditablePageField
  pages: FormPage[]
  fields: PageField[]
  references: FormReference[]
  onUpdate: (patch: Partial<PageField>) => void
  onMoveToPage: (pageId: number) => void
  onDelete: () => void
  onSaveConditions: (conditions: FieldCondition[]) => void
}

function SatisfactionSettings({ field, onUpdate }: Pick<FieldSettingsProps, 'field' | 'onUpdate'>) {
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
    <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <Field label="Rating scale">
        <select value={preset} onChange={(event) => selectPreset(event.target.value as SatisfactionPreset)} className={inputClass}>
          <option value="five-point">5-point satisfaction</option>
          <option value="stars">Star rating</option>
          <option value="svg-stars">Modern star rating</option>
          <option value="nps">Net Promoter Score (0–10)</option>
          <option value="custom">Custom scale</option>
        </select>
      </Field>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={`${option.value}-${index}`} className="grid grid-cols-[64px_minmax(0,1fr)_64px_32px] gap-2">
            {preset === 'svg-stars' ? (
              <span
                aria-label={`Rating ${index + 1} star visual`}
                className="flex h-10 items-center justify-center rounded-md border border-[#e6dfd8] bg-white text-[#cc785c]"
              >
                <StarIcon size={22} filled />
              </span>
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
      <p className="mt-2 text-xs leading-5 text-[#8e8b82]">The saved value is numeric and can be used in logic, calculations, submissions, and exports. Custom scales accept emoji or image URLs.</p>
    </div>
  )
}

function SettingsSection({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#e6dfd8] bg-white">
      <div className="flex items-start gap-3 border-b border-[#ebe6df] bg-[#f5f0e8] px-4 py-3">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white text-[#cc785c]">
          {icon}
        </span>
        <div>
          <h4 className="text-sm font-medium text-[#141413]">{title}</h4>
          <p className="mt-0.5 text-xs leading-5 text-[#8e8b82]">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </section>
  )
}

function SettingsAction({
  title,
  description,
  status,
  onClick,
}: {
  title: string
  description: string
  status: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 text-left transition-colors hover:border-[#cc785c]/70 hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#141413]">{title}</span>
          <span className="rounded bg-white px-2 py-0.5 text-xs text-[#6c6a64]">{status}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#8e8b82]">{description}</p>
      </div>
      <ChevronRight size={16} className="flex-none text-[#8e8b82] transition-transform group-hover:translate-x-0.5 group-hover:text-[#cc785c]" />
    </button>
  )
}

function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 transition-colors hover:border-[#cc785c]/60">
      <span>
        <span className="block text-sm font-medium text-[#141413]">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[#8e8b82]">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex flex-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-[#d8cec3] transition-colors peer-checked:bg-[#cc785c] peer-focus-visible:ring-2 peer-focus-visible:ring-[#cc785c]/30 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

function FieldSettings({ field, pages, fields, references, onUpdate, onMoveToPage, onDelete, onSaveConditions }: FieldSettingsProps) {
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
              <RichTextEditor value={field.placeholder ?? ''} onChange={(html) => onUpdate({ placeholder: html || null })} />
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

      <section className="rounded-xl border border-[#f0c2b8] bg-[#fff3ef] p-4">
        <h4 className="text-sm font-medium text-[#9f3f35]">Remove this field</h4>
        <p className="mt-1 text-xs leading-5 text-[#9f5b50]">This removes the field and its saved configuration from the draft.</p>
        <Button type="button" variant="danger" size="sm" onClick={onDelete} className="mt-3">
          <Trash2 size={14} /> Delete field
        </Button>
      </section>

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

function FieldDialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-dialog-title"
        className={`flex h-full max-h-none w-full flex-col bg-[#f5f0e8] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl ${
          wide ? 'sm:max-w-6xl' : 'sm:max-w-3xl'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 sm:rounded-t-2xl sm:px-5">
          <div>
            <p className="text-xs font-medium uppercase text-[#8e8b82]">{subtitle}</p>
            <h2 id="field-dialog-title" className="mt-1 text-lg font-medium text-[#141413]">{title}</h2>
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
        <div className={`flex-1 overflow-y-auto ${wide ? 'p-0' : 'p-4 sm:p-5'}`}>{children}</div>
        <div className="flex justify-end border-t border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 sm:rounded-b-2xl sm:px-5">
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

function computationSourceFields(fields: PageField[], currentFieldId: number, mode: FieldComputation['mode']) {
  if (mode === 'sum_number_fields') {
    return fields.filter((field) =>
      field.id !== currentFieldId &&
      (field.fieldType === 'number' ||
        (field.fieldType === 'computation' && field.validationRules?.computation?.outputMode !== 'text')),
    )
  }
  return fields.filter((field) =>
    field.id !== currentFieldId &&
    ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
    field.validationRules?.optionPricesEnabled &&
    field.options?.some((option) =>
      Number(option.price ?? 0) > 0 ||
      Number(option.additionalPrice ?? 0) > 0 ||
      Boolean(option.priceReference) ||
      Boolean(option.additionalPriceReference),
    ),
  )
}

function computationFormulaFields(
  fields: PageField[],
  currentField: PageField,
  outputMode: FieldComputation['outputMode'] = 'number',
) {
  return fields.filter((field) =>
    field.id !== currentField.id &&
    (outputMode === 'text' ? fieldCanProvideTextValue(field) : fieldCanProvideFormulaValue(field)),
  )
}

function formulaOperatorSymbol(operator: FormulaOperator) {
  if (operator === 'set') return '='
  if (operator === 'add') return '+'
  if (operator === 'subtract') return '-'
  if (operator === 'multiply') return 'x'
  if (operator === 'divide') return '/'
  if (operator === 'concat') return 'combine'
  return '+%'
}

function formulaTermLabel(
  term: NonNullable<FieldComputation['terms']>[number],
  fields: PageField[],
) {
  if (term.source === 'field') {
    const field = fields.find((item) => item.bindVariable === term.fieldBinding)
    return field ? `{{${field.bindVariable}}}` : '{{field}}'
  }
  if (term.source === 'reference') return term.referenceKey ? `{{${term.referenceKey}}}` : '{{reference}}'
  return String(term.fixedValue ?? 0)
}

function ExpressionPreview({
  field,
  expression,
  terms,
  fields,
}: {
  field: PageField
  expression?: string | null
  terms: NonNullable<FieldComputation['terms']>
  fields: PageField[]
}) {
  const expressionTokens = expression?.trim()
  return (
    <div className="rounded-xl border border-[#e6dfd8] bg-white p-4">
      <p className="mb-3 text-xs font-medium uppercase text-[#8e8b82]">Formula</p>
      <div className="flex flex-wrap items-center gap-2">
        {formulaToken(`{{${field.bindVariable}}}`, 'total', 'target')}
        {formulaToken('=', 'operator', 'equals')}
        {expressionTokens ? (
          <span className="rounded-md border border-[#e6dfd8] bg-white px-2.5 py-1.5 font-mono text-sm text-[#141413]">
            {expressionTokens}
          </span>
        ) : terms.length === 0 ? (
          formulaToken('Add fields or references', 'source', 'empty')
        ) : (
          terms.map((term, index) => (
            <span key={term.id ?? index} className="contents">
              {index > 0 && formulaToken(formulaOperatorSymbol(term.operator), 'operator', `operator-${index}`)}
              {formulaToken(formulaTermLabel(term, fields), term.source === 'reference' ? 'reference' : 'source', `term-${index}`)}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

function FormulaComposer({
  field,
  fields,
  references,
  expression,
  outputMode,
  onChange,
}: {
  field: PageField
  fields: PageField[]
  references: FormReference[]
  expression: string
  outputMode: FieldComputation['outputMode']
  onChange: (expression: string) => void
}) {
  const [variableSearch, setVariableSearch] = useState('')
  const availableFields = computationFormulaFields(fields, field, outputMode)
  const availableReferences = references.filter((reference) =>
    outputMode === 'text' || reference.type === 'number' || reference.type === 'percentage',
  )
  const variableItems = [
    ...availableFields.map((item) => ({
      key: `field-${item.id}`,
      label: item.label || item.bindVariable,
      binding: item.bindVariable,
      kind: item.fieldType === 'computation' ? 'Calculated' : item.fieldType === 'number' ? 'Number' : item.fieldType === 'email' ? 'Email' : 'Answer',
      source: item.fieldType === 'computation' ? 'Calculated values' : 'Form answers',
      token: `{{${item.bindVariable}}}`,
    })),
    ...availableReferences.map((reference) => ({
      key: `reference-${reference.id}`,
      label: reference.label || reference.key,
      binding: reference.key,
      kind: reference.type === 'percentage' ? 'Percent' : reference.type === 'number' ? 'Number' : reference.type === 'boolean' ? 'True/false' : 'Text',
      source: 'References',
      token: `{{${reference.key}}}`,
    })),
  ].filter((item) => {
    const query = variableSearch.trim().toLowerCase()
    return !query || `${item.label} ${item.binding} ${item.kind}`.toLowerCase().includes(query)
  })

  function append(value: string) {
    onChange(`${expression}${expression.trim() ? ' ' : ''}${value}`.trimStart())
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#d9d0c5] bg-white">
      <div className="border-b border-[#e6dfd8] bg-[#faf9f5] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#141413]">Formula syntax</p>
            <p className="mt-1 text-xs leading-5 text-[#746f68]">
          {outputMode === 'text'
            ? <>Combine bindings like {`{{first_name}}`} with quoted text such as <span className="font-mono">" "</span>.</>
            : <>Use bindings like {`{{subtotal}}`} and references like {`{{vat_rate}}`}.</>}
            </p>
          </div>
          <span className="rounded-full border border-[#d9d0c5] bg-white px-2.5 py-1 font-mono text-[11px] text-[#746f68]">
            {outputMode === 'text' ? 'text formula' : 'numeric formula'}
          </span>
        </div>
      </div>
      <div className="p-4">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#746f68]" htmlFor={`formula-${field.id}`}>
          Formula
        </label>
        <textarea
          id={`formula-${field.id}`}
          value={expression}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          spellCheck={false}
          className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#d9d0c5] bg-[#1f2421] px-4 py-3 font-mono text-sm leading-7 text-[#f8f3ea] outline-none transition-shadow placeholder:text-[#89908a] focus:border-[#cc785c] focus:ring-4 focus:ring-[#cc785c]/15"
          placeholder={outputMode === 'text'
            ? '{{first_name}} concat " " concat {{last_name}}'
            : '{{subtotal}} +% {{vat_rate}} + {{processing_fee}}'}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Formula operators">
          {(outputMode === 'text'
            ? [['concat', 'Combine text']]
            : [
                ['+', 'Add'],
                ['-', 'Subtract'],
                ['*', 'Multiply'],
                ['/', 'Divide'],
                ['+%', 'Add percent'],
              ]).map(([symbol, label]) => (
            <button
              key={symbol}
              type="button"
              onClick={() => append(symbol)}
              className="rounded-md border border-[#ded6cd] bg-[#faf9f5] px-2.5 py-1.5 text-xs font-medium text-[#4f4a44] transition-colors hover:border-[#cc785c] hover:bg-[#fff6f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
            >
              <span className="font-mono text-[#a9583e]">{symbol}</span>
              <span className="ml-1.5">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e6dfd8] bg-[#faf9f5] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#141413]">Insert a variable</p>
            <p className="mt-0.5 text-xs text-[#746f68]">Only variables compatible with this output are shown.</p>
          </div>
          <label className="relative block sm:w-64">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8b82]" />
            <span className="sr-only">Search variables</span>
            <input
              value={variableSearch}
              onChange={(event) => setVariableSearch(event.target.value)}
              placeholder="Search variables"
              className="h-9 w-full rounded-lg border border-[#ded6cd] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            />
          </label>
        </div>
        {variableItems.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-[#d9d0c5] bg-white px-4 py-6 text-center">
            <Variable size={18} className="mx-auto text-[#b2aca4]" />
            <p className="mt-2 text-sm font-medium text-[#5f5a53]">No matching variables</p>
            <p className="mt-1 text-xs text-[#8e8b82]">Add a compatible field or clear the search.</p>
          </div>
        ) : (
          <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {variableItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => append(item.token)}
                className="group flex min-w-0 items-center gap-3 rounded-lg border border-[#e1d9d0] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#cc785c] hover:bg-[#fff8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#f3ece5] text-[#a9583e]">
                  {item.source === 'Calculated values' ? <Calculator size={15} /> : item.source === 'References' ? <Variable size={15} /> : <ListPlus size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#2e2b28]">{item.label}</span>
                  <span className="block truncate font-mono text-[11px] text-[#8e8b82]">{`{{${item.binding}}}`}</span>
                </span>
                <span className="flex-none rounded-full bg-[#f1efeb] px-2 py-0.5 text-[10px] font-medium text-[#746f68]">{item.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function checkFormulaExpression(
  expression: string,
  currentField: PageField,
  fields: PageField[],
  references: FormReference[],
  outputMode: FieldComputation['outputMode'] = 'number',
) {
  const errors: string[] = []
  const warnings: string[] = []
  const trimmed = expression.trim()
  const fieldBindings = new Set(fields.map((item) => item.bindVariable))
  const referencesByKey = new Map(references.map((reference) => [reference.key, reference]))
  const textMode = outputMode === 'text'
  const tokenPattern = textMode
    ? /\{\{\s*[a-z][a-z0-9_]*\s*\}\}|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\bconcat\b|\+/gi
    : /\+%|\{\{\s*[a-z][a-z0-9_]*\s*\}\}|[+\-*/]|-?\d+(?:\.\d+)?/gi
  const tokens = trimmed.match(tokenPattern) ?? []

  if (!trimmed) {
    warnings.push(textMode
      ? 'Add at least one field, reference, or quoted text value.'
      : 'Add at least one field, reference, or fixed number.')
    return { errors, warnings }
  }

  const leftovers = trimmed.replace(tokenPattern, '').replace(/\s+/g, '')
  if (leftovers) {
    errors.push(`Unsupported text in formula: "${leftovers}".`)
  }

  let expectingValue = true
  let valueCount = 0
  let lastOperator = ''
  for (const token of tokens) {
    const isOperator = textMode
      ? token === '+' || token.toLowerCase() === 'concat'
      : ['+', '-', '*', '/', '+%'].includes(token)
    if (isOperator) {
      if (expectingValue) {
        errors.push(`Operator "${token}" needs a value before it.`)
      }
      expectingValue = true
      lastOperator = token
      continue
    }

    if (!expectingValue) {
      errors.push(`Missing an operator before "${token}".`)
    }
    expectingValue = false
    valueCount += 1

    const bindingMatch = token.match(/^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/i)
    if (bindingMatch) {
      const key = bindingMatch[1]
      if (key === currentField.bindVariable) {
        errors.push(`This formula cannot reference itself: {{${key}}}.`)
      } else if (!fieldBindings.has(key) && !referencesByKey.has(key)) {
        errors.push(`Unknown field or reference: {{${key}}}.`)
      } else {
        const reference = referencesByKey.get(key)
        if (!textMode && reference && !['number', 'percentage'].includes(reference.type)) {
          errors.push(`Reference {{${key}}} is ${reference.type}; formulas need number or percentage references.`)
        }
      }
      continue
    }

    if (textMode) continue
    const numberValue = Number(token)
    if (!Number.isFinite(numberValue)) {
      errors.push(`Invalid number: ${token}.`)
    }
    if (lastOperator === '/' && numberValue === 0) {
      errors.push('Formula divides by zero.')
    }
  }

  if (valueCount === 0) {
    errors.push('Formula needs at least one value.')
  }
  if (expectingValue && tokens.length > 0) {
    errors.push('Formula ends with an operator.')
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

function fieldCanProvideFormulaValue(field: PageField) {
  return field.fieldType === 'number' ||
    field.fieldType === 'satisfaction' ||
    (field.fieldType === 'computation' && field.validationRules?.computation?.outputMode !== 'text') ||
    (['select', 'checkbox', 'radio'].includes(field.fieldType) && Boolean(field.validationRules?.optionPricesEnabled))
}

function fieldCanProvideTextValue(field: PageField) {
  return !['content', 'media', 'address', 'recaptcha', 'file_upload'].includes(field.fieldType)
}

function expressionFieldBindings(expression: string) {
  return [...expression.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)].map((match) => match[1])
}

function computationFieldDependencies(field: PageField) {
  const computation = field.validationRules?.computation
  if (!computation) return []
  const useSyntax = computation.editorMode === 'syntax' ||
    (computation.editorMode == null && Boolean(computation.expression?.trim()))
  if (computation.mode === 'expression' && useSyntax && computation.expression?.trim()) {
    return expressionFieldBindings(computation.expression)
  }
  if (computation.mode === 'expression') {
    return (computation.terms ?? [])
      .filter((term) => term.source === 'field' && term.fieldBinding)
      .map((term) => term.fieldBinding!)
  }
  return computation.fieldBindings ?? []
}

function hasComputationCycle(currentField: PageField, fields: PageField[]) {
  const byBinding = new Map(fields.map((field) => [field.bindVariable, field]))

  function visit(binding: string, seen: Set<string>): boolean {
    if (binding === currentField.bindVariable) return true
    if (seen.has(binding)) return false
    const field = byBinding.get(binding)
    if (!field || field.fieldType !== 'computation') return false
    const nextSeen = new Set(seen)
    nextSeen.add(binding)
    return computationFieldDependencies(field).some((nextBinding) => visit(nextBinding, nextSeen))
  }

  return computationFieldDependencies(currentField).some((binding) => visit(binding, new Set([currentField.bindVariable])))
}

function checkComputationBlock(
  computation: FieldComputation,
  currentField: PageField,
  fields: PageField[],
  references: FormReference[],
) {
  const errors: string[] = []
  const warnings: string[] = []
  const mode = computation.mode ?? 'expression'
  const compatibleFormulaFields = computationFormulaFields(fields, currentField, computation.outputMode)
  const compatiblePricedFields = computationSourceFields(fields, currentField.id, 'sum_priced_options')
  const compatibleNumberFields = computationSourceFields(fields, currentField.id, 'sum_number_fields')
  const fieldByBinding = new Map(fields.map((field) => [field.bindVariable, field]))
  const referenceByKey = new Map(references.map((reference) => [reference.key, reference]))

  if (!currentField.bindVariable) {
    errors.push('This computation block needs a binding so other fields and payment can reference it.')
  }

  if (mode === 'expression') {
    const useSyntax = computation.editorMode === 'syntax' ||
      (computation.editorMode == null && Boolean(computation.expression?.trim()))
    if (useSyntax && computation.expression?.trim()) {
      const expressionCheck = checkFormulaExpression(
        computation.expression,
        currentField,
        compatibleFormulaFields,
        references,
        computation.outputMode,
      )
      errors.push(...expressionCheck.errors)
      warnings.push(...expressionCheck.warnings)
    } else if (useSyntax) {
      warnings.push(computation.outputMode === 'text'
        ? 'Write a formula using variables and quoted text.'
        : 'Write a formula using variables, references, or numbers.')
    } else {
      const terms = computation.terms ?? []
      if (terms.length === 0) {
        errors.push('Add a formula, formula row, field, reference, or fixed number.')
      }
      for (const [index, term] of terms.entries()) {
        if (index > 0 && !term.operator) errors.push(`Formula row ${index + 1} needs an operation.`)
        if (term.source === 'field') {
          if (!term.fieldBinding) {
            errors.push(`Formula row ${index + 1} needs a field binding.`)
          } else if (term.fieldBinding === currentField.bindVariable) {
            errors.push(`Formula row ${index + 1} cannot reference this computation block itself.`)
          } else {
            const field = fieldByBinding.get(term.fieldBinding)
            if (!field) errors.push(`Formula row ${index + 1} references missing field {{${term.fieldBinding}}}.`)
            else if (computation.outputMode === 'text'
              ? !fieldCanProvideTextValue(field)
              : !fieldCanProvideFormulaValue(field)) {
              errors.push(computation.outputMode === 'text'
                ? `Formula row ${index + 1} uses {{${term.fieldBinding}}}, but that field cannot provide text.`
                : `Formula row ${index + 1} uses {{${term.fieldBinding}}}, but that field cannot provide a numeric value.`)
            }
          }
        }
        if (term.source === 'reference') {
          if (!term.referenceKey) {
            errors.push(`Formula row ${index + 1} needs a reference.`)
          } else {
            const reference = referenceByKey.get(term.referenceKey)
            if (!reference) errors.push(`Formula row ${index + 1} references missing reference {{${term.referenceKey}}}.`)
            else if (computation.outputMode !== 'text' && !['number', 'percentage'].includes(reference.type)) {
              errors.push(`Formula row ${index + 1} uses {{${term.referenceKey}}}, but formulas need number or percentage references.`)
            }
          }
        }
        if (computation.outputMode !== 'text' && term.source === 'fixed' && !Number.isFinite(Number(term.fixedValue ?? 0))) {
          errors.push(`Formula row ${index + 1} has an invalid fixed number.`)
        }
        if (computation.outputMode !== 'text' && term.operator === 'divide' && term.source === 'fixed' && Number(term.fixedValue ?? 0) === 0) {
          errors.push(`Formula row ${index + 1} divides by zero.`)
        }
        if (computation.outputMode === 'text' && index > 0 && term.operator !== 'concat' && term.operator !== 'add') {
          errors.push(`Text row ${index + 1} must use Combine.`)
        }
      }
    }
  }

  if (mode === 'sum_priced_options' || mode === 'formula') {
    const selected = computation.fieldBindings ?? []
    if (compatiblePricedFields.length === 0) {
      errors.push('No priced option fields are available. Enable option prices on a checkbox, radio, or dropdown field first.')
    }
    for (const binding of selected) {
      const field = fieldByBinding.get(binding)
      if (!field) errors.push(`Selected priced field {{${binding}}} no longer exists.`)
      else if (!compatiblePricedFields.some((item) => item.bindVariable === binding)) {
        errors.push(`Selected field {{${binding}}} is not a priced option field.`)
      }
    }
    if (selected.length === 0 && compatiblePricedFields.length > 0) {
      warnings.push('No specific priced fields selected; this block will use all available priced option fields.')
    }
  }

  if (mode === 'sum_number_fields') {
    const selected = computation.fieldBindings ?? []
    if (compatibleNumberFields.length === 0) {
      errors.push('No number or computation fields are available to sum.')
    }
    for (const binding of selected) {
      const field = fieldByBinding.get(binding)
      if (!field) errors.push(`Selected number field {{${binding}}} no longer exists.`)
      else if (!compatibleNumberFields.some((item) => item.bindVariable === binding)) {
        errors.push(`Selected field {{${binding}}} is not a number or computation field.`)
      }
    }
    if (selected.length === 0 && compatibleNumberFields.length > 0) {
      warnings.push('No specific number fields selected; this block will use all available number and computation fields.')
    }
  }

  if (mode === 'formula') {
    for (const adjustment of computation.adjustments ?? []) {
      const reference = referenceByKey.get(adjustment.referenceKey)
      if (!adjustment.referenceKey) errors.push('Formula adjustment needs a reference.')
      else if (!reference) errors.push(`Formula adjustment references missing reference {{${adjustment.referenceKey}}}.`)
      else if (!['number', 'percentage'].includes(reference.type)) {
        errors.push(`Formula adjustment {{${adjustment.referenceKey}}} must be a number or percentage reference.`)
      }
    }
  }

  if (hasComputationCycle(currentField, fields)) {
    errors.push('This computation has a circular dependency with another computation block.')
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

function ExpressionBuilder({
  field,
  fields,
  references,
  terms,
  outputMode,
  onChange,
}: {
  field: PageField
  fields: PageField[]
  references: FormReference[]
  terms: NonNullable<FieldComputation['terms']>
  outputMode: FieldComputation['outputMode']
  onChange: (terms: NonNullable<FieldComputation['terms']>) => void
}) {
  const availableFields = computationFormulaFields(fields, field, outputMode)
  const availableReferences = references.filter((reference) =>
    outputMode === 'text' || reference.type === 'number' || reference.type === 'percentage',
  )

  function updateTerm(index: number, patch: Partial<NonNullable<FieldComputation['terms']>[number]>) {
    onChange(terms.map((term, termIndex) => (termIndex === index ? { ...term, ...patch } : term)))
  }

  function addTerm() {
    onChange([
      ...terms,
      {
        id: tempId().toString(),
        operator: terms.length === 0 ? 'set' : outputMode === 'text' ? 'concat' : 'add',
        source: availableFields.length > 0 ? 'field' : availableReferences.length > 0 ? 'reference' : 'fixed',
        fieldBinding: availableFields[0]?.bindVariable ?? null,
        referenceKey: availableFields.length === 0 ? availableReferences[0]?.key ?? null : null,
        fixedValue: outputMode === 'text' ? '' : 0,
      },
    ])
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#d9d0c5] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e6dfd8] bg-[#faf9f5] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#141413]">Visual formula</p>
          <p className="mt-1 text-xs leading-5 text-[#746f68]">
            Build the result one step at a time. Each row continues from the value above it.
          </p>
        </div>
        <button
          type="button"
          onClick={addTerm}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#2f3933] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#202923] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] sm:self-auto"
        >
          <Plus size={14} /> Add step
        </button>
      </div>

      {terms.length === 0 ? (
        <button
          type="button"
          onClick={addTerm}
          className="m-4 flex w-[calc(100%-2rem)] flex-col items-center rounded-xl border border-dashed border-[#cfc5ba] bg-[#faf9f5] px-5 py-10 text-center transition-colors hover:border-[#cc785c] hover:bg-[#fff8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#efe6de] text-[#a9583e]">
            <Sparkles size={19} />
          </span>
          <span className="mt-3 text-sm font-semibold text-[#3d3935]">Start with a value</span>
          <span className="mt-1 max-w-sm text-xs leading-5 text-[#7d766f]">
            Choose a form answer, another calculated value, a reference, or a fixed {outputMode === 'text' ? 'piece of text' : 'number'}.
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {terms.map((term, index) => (
            <div key={term.id ?? index} className="relative rounded-xl border border-[#e1d9d0] bg-[#faf9f5] p-3 pl-12 sm:p-4 sm:pl-14">
              <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#2f3933] text-xs font-semibold text-white sm:left-4 sm:top-4">
                {index + 1}
              </span>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[130px_150px_minmax(0,1fr)_40px] lg:items-end">
                <FieldGroup label={index === 0 ? 'Begin with' : 'Operation'}>
                  <select
                    aria-label={`Step ${index + 1} operation`}
                    value={index === 0 ? 'set' : term.operator}
                    onChange={(e) => updateTerm(index, { operator: e.target.value as FormulaOperator })}
                    disabled={index === 0}
                    className={inputClass}
                  >
                    <option value="set">Start</option>
                    {outputMode === 'text' ? (
                      <option value="concat">Combine with</option>
                    ) : (
                      <>
                        <option value="add">Add</option>
                        <option value="subtract">Subtract</option>
                        <option value="multiply">Multiply by</option>
                        <option value="divide">Divide by</option>
                        <option value="percent">Add percent</option>
                      </>
                    )}
                  </select>
                </FieldGroup>
                <FieldGroup label="Value source">
                  <select
                    aria-label={`Step ${index + 1} source`}
                    value={term.source}
                    onChange={(e) => {
                      const source = e.target.value as FormulaTermSource
                      updateTerm(index, {
                        source,
                        fieldBinding: source === 'field' ? availableFields[0]?.bindVariable ?? null : null,
                        referenceKey: source === 'reference' ? availableReferences[0]?.key ?? null : null,
                        fixedValue: source === 'fixed' ? term.fixedValue ?? (outputMode === 'text' ? '' : 0) : null,
                      })
                    }}
                    className={inputClass}
                  >
                    <option value="field">Form variable</option>
                    <option value="reference">Reference</option>
                    <option value="fixed">{outputMode === 'text' ? 'Fixed text' : 'Fixed number'}</option>
                  </select>
                </FieldGroup>
                <FieldGroup label={term.source === 'field' ? 'Variable' : term.source === 'reference' ? 'Reference' : outputMode === 'text' ? 'Text' : 'Number'}>
                  {term.source === 'field' ? (
                    <select
                      aria-label={`Step ${index + 1} variable`}
                      value={term.fieldBinding ?? ''}
                      onChange={(e) => updateTerm(index, { fieldBinding: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select a compatible variable...</option>
                      {availableFields.map((item) => (
                        <option key={item.id} value={item.bindVariable}>
                          {item.label || item.bindVariable} {`{{${item.bindVariable}}}`}
                        </option>
                      ))}
                    </select>
                  ) : term.source === 'reference' ? (
                    <select
                      aria-label={`Step ${index + 1} reference`}
                      value={term.referenceKey ?? ''}
                      onChange={(e) => updateTerm(index, { referenceKey: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select a compatible reference...</option>
                      {availableReferences.map((reference) => (
                        <option key={reference.id} value={reference.key}>
                          {reference.label || reference.key} {`{{${reference.key}}}`} = {reference.value}
                        </option>
                      ))}
                    </select>
                  ) : outputMode === 'text' ? (
                    <input
                      type="text"
                      aria-label={`Step ${index + 1} fixed text`}
                      value={String(term.fixedValue ?? '')}
                      placeholder="Text to combine"
                      onChange={(e) => updateTerm(index, { fixedValue: e.target.value })}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      type="number"
                      aria-label={`Step ${index + 1} fixed number`}
                      step="any"
                      value={term.fixedValue ?? 0}
                      onChange={(e) => updateTerm(index, { fixedValue: Number(e.target.value) })}
                      className={inputClass}
                    />
                  )}
                </FieldGroup>
                <button
                  type="button"
                  onClick={() => onChange(terms.filter((_, termIndex) => termIndex !== index))}
                  className="flex h-10 w-full items-center justify-center rounded-lg text-[#b24b42] transition-colors hover:bg-[#fff0ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545] lg:w-10"
                  aria-label={`Remove step ${index + 1}`}
                  title="Remove step"
                >
                  <Trash2 size={16} />
                  <span className="ml-2 text-xs font-medium lg:hidden">Remove step</span>
                </button>
              </div>
              {index < terms.length - 1 && (
                <span className="absolute -bottom-3 left-[25px] h-3 w-px bg-[#cfc5ba] sm:left-[29px]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type ComputationOutputChoice = 'automatic' | 'integer' | 'decimal' | 'text'

function computationOutputChoice(computation: FieldComputation): ComputationOutputChoice {
  if (computation.outputMode === 'text') return 'text'
  return computation.numericType ?? 'automatic'
}

function sampleValueForField(field: PageField): unknown {
  if (field.fieldType === 'number') return 12.5
  if (field.fieldType === 'satisfaction') return Number(field.options?.[0]?.value ?? 5)
  if (field.fieldType === 'checkbox') return field.options?.[0] ? [field.options[0].value] : []
  if (field.fieldType === 'select' || field.fieldType === 'radio') return field.options?.[0]?.value ?? ''
  if (field.fieldType === 'email') return 'alex@example.com'
  if (field.fieldType === 'date') return '2026-07-24'
  if (field.fieldType === 'time') return '09:30'
  if (field.fieldType === 'datetime') return '2026-07-24T09:30'
  if (field.fieldType === 'text' || field.fieldType === 'textarea') return field.label ? `Sample ${field.label.toLowerCase()}` : 'Sample text'
  return ''
}

function computationPreview(
  computation: FieldComputation,
  currentField: PageField,
  fields: PageField[],
  references: FormReference[],
) {
  const sampleData = Object.fromEntries(
    fields
      .filter((item) => item.id !== currentField.id && item.fieldType !== 'computation')
      .map((item) => [item.bindVariable, sampleValueForField(item)]),
  )
  const scope = { ...buildReferenceMap(references), ...sampleData }
  return calculateFieldComputation(
    computation,
    fields,
    scope,
    references,
    [currentField.bindVariable],
  )
}

function ComputationResultConsole({
  field,
  computation,
  preview,
  check,
}: {
  field: PageField
  computation: FieldComputation
  preview: ReturnType<typeof computationPreview>
  check: { errors: string[]; warnings: string[] }
}) {
  const isText = computation.outputMode === 'text'
  const numericValue = Number(preview.value)
  const displayValue = isText
    ? String(preview.value || 'Your text result')
    : Number.isFinite(numericValue)
      ? new Intl.NumberFormat(undefined, {
          minimumFractionDigits: computation.numericType === 'decimal' ? computation.decimalPlaces ?? 2 : 0,
          maximumFractionDigits: computation.numericType === 'integer' ? 0 : computation.numericType === 'decimal' ? computation.decimalPlaces ?? 2 : 10,
        }).format(numericValue)
      : '0'
  const outputLabel = isText
    ? 'Text'
    : computation.numericType === 'integer'
      ? 'Whole number'
      : computation.numericType === 'decimal'
        ? `Decimal · ${computation.decimalPlaces ?? 2} places`
        : 'Number · automatic precision'

  return (
    <aside className="space-y-4 lg:sticky lg:top-0">
      <section className="overflow-hidden rounded-xl border border-[#36423b] bg-[#26312b] text-white shadow-[0_16px_40px_rgba(35,43,38,0.12)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#efb79f]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#d9dfdb]">Result preview</p>
          </div>
          <span className={`h-2 w-2 rounded-full ${check.errors.length > 0 ? 'bg-[#f08b78]' : 'bg-[#8bc48d]'}`} />
        </div>
        <div className="p-5">
          <p className="text-xs text-[#aeb8b2]">Illustrative result</p>
          <p className={`mt-2 break-words font-semibold tracking-tight ${isText ? 'text-2xl leading-8' : 'text-4xl tabular-nums'}`}>
            {displayValue}
          </p>
          <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-[#aeb8b2]">Saved as</span>
              <span className="font-medium text-white">{outputLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-[#aeb8b2]">Variable</span>
              <code className="max-w-[65%] truncate rounded bg-white/10 px-2 py-1 text-[#f7d8c9]">{`{{${field.bindVariable || 'calculated_value'}}}`}</code>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#ddd4ca] bg-white p-4">
        <p className="text-sm font-semibold text-[#292622]">Calculation health</p>
        <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs leading-5 ${
          check.errors.length > 0
            ? 'bg-[#fff0ec] text-[#9f3f35]'
            : check.warnings.length > 0
              ? 'bg-[#fff8e8] text-[#765b2d]'
              : 'bg-[#eef8ed] text-[#3f7042]'
        }`}>
          {check.errors.length > 0 ? <Info size={15} className="mt-0.5 flex-none" /> : <Check size={15} className="mt-0.5 flex-none" />}
          <div>
            <p className="font-semibold">
              {check.errors.length > 0 ? `${check.errors.length} item${check.errors.length === 1 ? '' : 's'} to fix` : check.warnings.length > 0 ? 'Ready with a note' : 'Ready to calculate'}
            </p>
            <p className="mt-0.5">
              {check.errors[0] ?? check.warnings[0] ?? 'The result updates whenever a source answer changes.'}
            </p>
          </div>
        </div>
        {check.errors.length + check.warnings.length > 1 && (
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-[#746f68]">
            {[...check.errors.slice(1), ...check.warnings.slice(check.errors.length > 0 ? 0 : 1)].map((message) => (
              <li key={message} className="flex gap-2">
                <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[#b2aaa2]" />
                <span>{message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-xs leading-5 text-[#8e8b82]">
        Preview uses example answers and your current reference values. The published form recalculates with each respondent’s answers.
      </p>
    </aside>
  )
}

function ComputationDialog({
  field,
  fields,
  references,
  computation,
  onClose,
  onChange,
}: {
  field: PageField
  fields: PageField[]
  references: FormReference[]
  computation: FieldComputation
  onClose: () => void
  onChange: (computation: FieldComputation) => void
}) {
  const outputChoice = computationOutputChoice(computation)
  const mode = computation.outputMode === 'text' ? 'expression' : computation.mode ?? 'expression'
  const editorMode = computation.editorMode ??
    (computation.expression?.trim() ? 'syntax' : 'visual')
  const numericReferences = references.filter((reference) => reference.type === 'number' || reference.type === 'percentage')
  const availableFields = computationSourceFields(fields, field.id, mode)
  const selectedBindings = computation.fieldBindings ?? []
  const computationCheck = checkComputationBlock(computation, field, fields, references)
  const preview = computationPreview(computation, field, fields, references)

  function update(patch: Partial<FieldComputation>) {
    onChange({ ...computation, ...patch })
  }

  function selectOutput(choice: ComputationOutputChoice) {
    const text = choice === 'text'
    const nextTerms = (computation.terms ?? []).map((term, index) => ({
      ...term,
      operator: index === 0 ? 'set' as const : text ? 'concat' as const : term.operator === 'concat' ? 'add' as const : term.operator,
      fixedValue: text
        ? String(term.fixedValue ?? '')
        : term.source === 'fixed'
          ? Number(term.fixedValue ?? 0)
          : term.fixedValue,
    }))
    update({
      outputMode: text ? 'text' : 'number',
      numericType: text ? computation.numericType : choice,
      decimalPlaces: choice === 'decimal' ? computation.decimalPlaces ?? 2 : computation.decimalPlaces,
      mode: text ? 'expression' : mode,
      terms: nextTerms,
    })
  }

  function selectMode(nextMode: FieldComputation['mode']) {
    update({
      mode: nextMode,
      fieldBindings: nextMode === mode ? computation.fieldBindings : [],
      adjustments: nextMode === 'formula' ? computation.adjustments ?? [] : computation.adjustments,
    })
  }

  function toggleBinding(binding: string, checked: boolean) {
    const current = new Set(computation.fieldBindings ?? [])
    if (checked) current.add(binding)
    else current.delete(binding)
    update({ fieldBindings: [...current] })
  }

  return (
    <FieldDialog
      title="Calculation studio"
      subtitle={field.label || 'Calculated value'}
      onClose={onClose}
      wide
    >
      <div className="bg-[#f5f0e8]">
        <div className="border-b border-[#ded6cd] bg-white px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#2f3933] text-white">
                <Calculator size={19} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[#24211e]">What should this field produce?</h3>
                <p className="mt-1 text-sm leading-6 text-[#746f68]">
                  Choose the saved result first. Ponko will show only compatible variables and operations.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Calculation output type">
              {([
                ['automatic', Hash, 'Number', 'Keep the calculated precision.'],
                ['integer', List, 'Whole number', 'Round the result to an integer.'],
                ['decimal', Calculator, 'Decimal', 'Float/double-style decimal value.'],
                ['text', Type, 'Text', 'Combine written answers and values.'],
              ] as const).map(([choice, Icon, title, description]) => {
                const selected = outputChoice === choice
                return (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectOutput(choice)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                      selected
                        ? 'border-[#b8654d] bg-[#fff5ef] shadow-[0_0_0_1px_#b8654d]'
                        : 'border-[#ded6cd] bg-[#faf9f5] hover:border-[#c5b7aa] hover:bg-white'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg ${selected ? 'bg-[#b8654d] text-white' : 'bg-[#ece7e1] text-[#6f6861]'}`}>
                      <Icon size={15} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#302c28]">{title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#7d766f]">{description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {outputChoice === 'decimal' && (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#ead9cf] bg-[#fff9f5] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#3d3935]">Decimal precision</p>
                  <p className="mt-0.5 text-xs text-[#7d766f]">Round the saved value to this many places.</p>
                </div>
                <select
                  aria-label="Decimal places"
                  value={computation.decimalPlaces ?? 2}
                  onChange={(event) => update({ decimalPlaces: Number(event.target.value) })}
                  className={`${inputClass} sm:w-36`}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((places) => (
                    <option key={places} value={places}>{places} {places === 1 ? 'place' : 'places'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[#7d766f]">Calculation method</p>
            <div className={`mt-2 grid grid-cols-1 gap-2 ${computation.outputMode === 'text' ? 'sm:max-w-md' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
              {([
                ['expression', Sparkles, computation.outputMode === 'text' ? 'Combine text' : 'Build a formula', computation.outputMode === 'text' ? 'Join text variables and fixed words.' : 'Use visual steps or formula syntax.'],
                ['sum_number_fields', ListPlus, 'Sum numbers', 'Add selected number variables.'],
                ['sum_priced_options', CheckSquare, 'Total selected prices', 'Add prices from chosen options.'],
                ['formula', Calculator, 'Price with adjustments', 'Start with prices, then apply fees or rates.'],
              ] as const)
                .filter(([method]) => computation.outputMode !== 'text' || method === 'expression')
                .map(([method, Icon, title, description]) => {
                  const selected = mode === method
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => selectMode(method)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                        selected ? 'border-[#39463f] bg-[#39463f] text-white' : 'border-[#d9d0c5] bg-white text-[#302c28] hover:border-[#a99d91]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon size={15} className={selected ? 'text-[#efb79f]' : 'text-[#a9583e]'} />
                        {title}
                      </span>
                      <span className={`mt-1.5 block text-xs leading-5 ${selected ? 'text-[#d5ddd8]' : 'text-[#7d766f]'}`}>{description}</span>
                    </button>
                  )
                })}
            </div>
          </section>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <main className="min-w-0 space-y-4">
              {mode === 'expression' ? (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-[#d9d0c5] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#302c28]">Choose how you want to build</p>
                      <p className="mt-0.5 text-xs text-[#7d766f]">You can switch editors without losing either version.</p>
                    </div>
                    <div className="grid grid-cols-2 rounded-lg bg-[#efebe6] p-1" role="tablist" aria-label="Formula editor">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={editorMode === 'visual'}
                        onClick={() => update({ editorMode: 'visual' })}
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${editorMode === 'visual' ? 'bg-white text-[#302c28] shadow-sm' : 'text-[#746f68] hover:text-[#302c28]'}`}
                      >
                        Visual steps
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={editorMode === 'syntax'}
                        onClick={() => update({ editorMode: 'syntax' })}
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${editorMode === 'syntax' ? 'bg-white text-[#302c28] shadow-sm' : 'text-[#746f68] hover:text-[#302c28]'}`}
                      >
                        Formula syntax
                      </button>
                    </div>
                  </div>
                  <ExpressionPreview
                    field={field}
                    expression={editorMode === 'syntax' ? computation.expression : null}
                    terms={editorMode === 'visual' ? computation.terms ?? [] : []}
                    fields={fields}
                  />
                  {editorMode === 'syntax' ? (
                    <FormulaComposer
                      field={field}
                      fields={fields}
                      references={references}
                      expression={computation.expression ?? ''}
                      outputMode={computation.outputMode ?? 'number'}
                      onChange={(expression) => update({ expression, editorMode: 'syntax' })}
                    />
                  ) : (
                    <ExpressionBuilder
                      field={field}
                      fields={fields}
                      references={references}
                      terms={computation.terms ?? []}
                      outputMode={computation.outputMode ?? 'number'}
                      onChange={(terms) => update({ terms, editorMode: 'visual' })}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-[#d9d0c5] bg-white p-4">
                    <h4 className="text-sm font-semibold text-[#302c28]">
                      {mode === 'sum_number_fields' ? 'Choose number variables' : 'Choose priced answer fields'}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[#7d766f]">
                      {mode === 'sum_number_fields'
                        ? 'Every selected number is added to the result. Numeric calculated fields can be included too.'
                        : 'The prices attached to each respondent’s selected options are added automatically.'}
                    </p>
                    <div className="mt-4">
                      <PaymentFieldChecklist
                        fields={availableFields}
                        selected={selectedBindings}
                        emptyText={
                          mode === 'sum_number_fields'
                            ? 'No numeric fields are available yet. Add a number or numeric calculated field first.'
                            : 'No priced choices are available yet. Enable prices on a checkbox, radio, or dropdown field.'
                        }
                        onToggle={toggleBinding}
                      />
                    </div>
                  </div>
                  <FormulaPreview
                    sourceFields={availableFields}
                    selectedBindings={selectedBindings}
                    adjustments={mode === 'formula' ? computation.adjustments ?? [] : []}
                    references={numericReferences}
                  />
                  {mode === 'formula' && (
                    <FormulaAdjustmentsEditor
                      references={numericReferences}
                      adjustments={computation.adjustments ?? []}
                      onChange={(adjustments) => update({ adjustments })}
                    />
                  )}
                </>
              )}

              <section className="rounded-xl border border-[#d9d0c5] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f0ebe5] text-[#6d655e]">
                      {computation.visible === false || computation.showBreakdown === false ? <EyeOff size={16} /> : <Eye size={16} />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#302c28]">Show this result on the form</p>
                      <p className="mt-1 text-xs leading-5 text-[#7d766f]">
                        Hidden calculations still run and remain available to logic, payments, submissions, and exports.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={computation.visible !== false && computation.showBreakdown !== false}
                    onClick={() => {
                      const nextVisible = !(computation.visible !== false && computation.showBreakdown !== false)
                      update({ visible: nextVisible ? undefined : false, showBreakdown: nextVisible })
                    }}
                    className={`relative mt-1 h-6 w-11 flex-none rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                      computation.visible !== false && computation.showBreakdown !== false ? 'bg-[#b8654d]' : 'bg-[#c9c2ba]'
                    }`}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      computation.visible !== false && computation.showBreakdown !== false ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </section>
            </main>

            <ComputationResultConsole
              field={field}
              computation={computation}
              preview={preview}
              check={computationCheck}
            />
          </div>
        </div>
      </div>
    </FieldDialog>
  )
}

function OptionsDialog({
  field,
  references,
  showPrices,
  onClose,
  onChange,
}: {
  field: EditablePageField
  references: FormReference[]
  showPrices: boolean
  onClose: () => void
  onChange: (options: PageFieldOption[]) => void
}) {
  return (
    <FieldDialog title={field.label || 'Untitled field'} subtitle="Options" onClose={onClose}>
      <OptionsEditor
        options={field.options ?? []}
        showPrices={showPrices}
        references={references}
        onChange={onChange}
      />
    </FieldDialog>
  )
}

function OptionsEditor({
  options,
  showPrices,
  references,
  onChange,
}: {
  options: PageFieldOption[]
  showPrices: boolean
  references: FormReference[]
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
    onChange([
      ...options,
      {
        label,
        value: optionValueForLabel(label, options, options.length),
        price: showPrices ? 0 : null,
        priceReference: null,
        additionalPrice: null,
        additionalPriceReference: null,
      },
    ])
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

      <div className="overflow-x-auto">
      <div className={`grid min-w-[980px] ${showPrices ? 'grid-cols-[220px_190px_150px_150px_150px_150px_auto]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'} gap-2 px-1 pb-1 text-xs font-medium uppercase text-[#8e8b82]`}>
        <span>Label</span>
        <span>Value</span>
        {showPrices && <span>Base mode</span>}
        {showPrices && <span>Base amount</span>}
        {showPrices && <span>Additional mode</span>}
        {showPrices && <span>Additional amount</span>}
        <span className="sr-only">Remove</span>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={index} className={`grid min-w-[980px] ${showPrices ? 'grid-cols-[220px_190px_150px_150px_150px_150px_auto]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'} gap-2`}>
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
              <>
                <select
                  value={option.priceReference ? 'reference' : 'direct'}
                  onChange={(e) =>
                    updateOption(
                      index,
                      e.target.value === 'reference'
                        ? { priceReference: references[0]?.key ?? '', price: null }
                        : { priceReference: null, price: option.price ?? 0 },
                    )
                  }
                  className={inputClass}
                >
                  <option value="direct">Direct price</option>
                  <option value="reference">Reference</option>
                </select>
                {option.priceReference ? (
                  <select
                    value={option.priceReference}
                    onChange={(e) => updateOption(index, { priceReference: e.target.value || null })}
                    className={inputClass}
                  >
                    <option value="">Select reference...</option>
                    {references.map((reference) => (
                      <option key={reference.id} value={reference.key}>
                        {reference.label || reference.key} = {reference.value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={option.price ?? ''}
                    onChange={(e) => updateOption(index, { price: e.target.value === '' ? null : Number(e.target.value), priceReference: null })}
                    className={inputClass}
                  />
                )}
                <select
                  value={option.additionalPriceReference ? 'reference' : 'direct'}
                  onChange={(e) =>
                    updateOption(
                      index,
                      e.target.value === 'reference'
                        ? { additionalPriceReference: references[0]?.key ?? '', additionalPrice: null }
                        : { additionalPriceReference: null, additionalPrice: option.additionalPrice ?? 0 },
                    )
                  }
                  className={inputClass}
                >
                  <option value="direct">Direct extra</option>
                  <option value="reference">Reference</option>
                </select>
                {option.additionalPriceReference ? (
                  <select
                    value={option.additionalPriceReference}
                    onChange={(e) => updateOption(index, { additionalPriceReference: e.target.value || null })}
                    className={inputClass}
                  >
                    <option value="">Select reference...</option>
                    {references.map((reference) => (
                      <option key={reference.id} value={reference.key}>
                        {reference.label || reference.key} = {reference.value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={option.additionalPrice ?? ''}
                    placeholder="Optional"
                    onChange={(e) =>
                      updateOption(index, {
                        additionalPrice: e.target.value === '' ? null : Number(e.target.value),
                        additionalPriceReference: null,
                      })
                    }
                    className={inputClass}
                  />
                )}
              </>
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

const inputClass =
  'h-10 w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20'

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#141413]">{label}</span>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#141413]">{label}</span>
      {children}
      {hint && <span className="text-xs leading-5 text-[#8e8b82]">{hint}</span>}
    </label>
  )
}
