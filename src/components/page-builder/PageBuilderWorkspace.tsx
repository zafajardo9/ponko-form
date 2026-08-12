import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
} from 'react'
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
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import {
  savePageForm,
  type SavedPageForm,
} from '../../lib/server-fns/page-forms'
import {
  satisfactionOptions,
} from '../../lib/page-builder/satisfaction'
import type {
  FieldCondition,
  FormReference,
  FormPage,
  PageField,
} from '../../lib/page-builder/types'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import {
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  GripVertical,
  Plus,
  Search,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import {
  FIELD_CATEGORIES,
  FIELD_ITEMS,
  type FieldPaletteItem,
} from './PageBuilderConfig'

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

import { slugForBinding, tempId } from './PageBuilderUtils'
import {
  snapshotBuilder,
  sortPages,
  sortReferences,
  type EditablePage,
} from './PageBuilderState'
import type { EditablePageField } from './PageBuilderTypes'
import { ReferencesPanel, PageSettings } from './PageSettings'
import { SortableFieldCard, SortablePageTab } from './SortableComponents'
import { FieldSettings } from './FieldSettings'
import { FormSuccessCard } from '../page-form/FormSuccessCard'
import { CanvasAskMenu } from './CanvasAskMenu'

const FIELD_DRAG_TYPE = 'application/x-ponkoform-field'

function fieldDragKey(item: FieldPaletteItem) {
  return `${item.type}:${item.preset ?? item.label}`
}

export function PageBuilderWorkspace({
  formId,
  pages,
  references,
  gateways,
  onChanged,
  onDraftChange,
}: PageBuilderWorkspaceProps) {
  const toast = useToast()
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
  const [draggedPaletteItem, setDraggedPaletteItem] = useState<FieldPaletteItem | null>(null)
  const [isPaletteOverCanvas, setIsPaletteOverCanvas] = useState(false)
  const [dragAnnouncement, setDragAnnouncement] = useState('')
  const isResizingSettings = useRef(false)
  const canvasDragDepth = useRef(0)

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
      toast.success('Form changes saved', 'The latest pages, fields, and settings are now recorded.')
    },
    onError: (error) => {
      toast.error(
        'Form changes were not saved',
        error instanceof Error ? error.message : 'Check your connection and try again.',
      )
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
      finalContactEmail: null,
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

  function addFieldLocal(item: FieldPaletteItem, insertAt = currentPage?.fields.length ?? 0) {
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
              : fieldType === 'discount'
                ? 'Discount code'
              : '',
      placeholder: fieldType === 'content'
        ? '<p>Add helpful details for this page.</p>'
        : fieldType === 'computation'
          ? 'Calculated from selected fields.'
          : fieldType === 'file_upload'
            ? 'Upload an image or file.'
          : fieldType === 'discount'
            ? 'Enter a code to reduce the payment amount.'
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
      bindVariable: slugForBinding(isTerms ? 'terms_and_conditions' : fieldType === 'discount' ? 'discount_code' : fieldType, used),
      position: insertAt,
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
      conditionMatch: 'all',
      conditions: [],
    }
    setDraftPages((items) =>
      items.map((page) => {
        if (page.id !== currentPage.id) return page
        const nextFields = [...page.fields]
        const nextIndex = Math.max(0, Math.min(insertAt, nextFields.length))
        nextFields.splice(nextIndex, 0, field)
        return {
          ...page,
          fields: nextFields.map((item, index) => ({ ...item, position: index })),
        }
      }),
    )
    setPanelMode('settings')
    setSelection({ type: 'field', fieldId: field.id })
    setMobilePaletteOpen(false)
    setMobileSettingsOpen(true)
  }

  function startPaletteDrag(event: ReactDragEvent<HTMLButtonElement>, item: FieldPaletteItem) {
    if (currentPage.isFinal) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(FIELD_DRAG_TYPE, fieldDragKey(item))
    event.dataTransfer.setData('text/plain', item.label)
    setDraggedPaletteItem(item)
    setDragAnnouncement(`Dragging ${item.label}. Drop it on the form canvas to add it.`)
  }

  function finishPaletteDrag() {
    canvasDragDepth.current = 0
    setDraggedPaletteItem(null)
    setIsPaletteOverCanvas(false)
  }

  function dropPaletteField(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault()
    const key = event.dataTransfer.getData(FIELD_DRAG_TYPE)
    const item = draggedPaletteItem ?? FIELD_ITEMS.find((candidate) => fieldDragKey(candidate) === key)
    if (!item || currentPage.isFinal) {
      finishPaletteDrag()
      return
    }

    const targetCard = (event.target as Element | null)?.closest<HTMLElement>('[data-field-card-id]')
    const targetFieldId = targetCard ? Number(targetCard.dataset.fieldCardId) : Number.NaN
    const targetIndex = currentPage.fields.findIndex((field) => field.id === targetFieldId)
    addFieldLocal(item, targetIndex >= 0 ? targetIndex : currentPage.fields.length)
    setDragAnnouncement(`${item.label} added to ${currentPage.title}.`)
    finishPaletteDrag()
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
      <p role="status" aria-live="polite" className="sr-only">
        {dragAnnouncement}
      </p>
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
          <p className="mb-3 text-xs leading-5 text-[#817d76]">
            Click to add, or drag a field onto the canvas.
          </p>
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
                          draggable={!currentPage.isFinal}
                          disabled={currentPage.isFinal}
                          onClick={() => addFieldLocal(item)}
                          onDragStart={(event) => startPaletteDrag(event, item)}
                          onDragEnd={finishPaletteDrag}
                          title={item.description}
                          className={`group min-w-0 cursor-grab rounded-lg border border-[#e6dfd8] bg-[#faf9f5] text-sm transition-[transform,opacity,border-color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:border-[#cc785c] hover:bg-[#efe9de] active:cursor-grabbing active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30 motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${
                            draggedPaletteItem && fieldDragKey(draggedPaletteItem) === fieldDragKey(item)
                              ? 'scale-[0.98] border-[#cc785c] bg-[#fff7f3] opacity-55 shadow-inner'
                              : ''
                          } ${
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
                          {paletteView === 'list' && (
                            <GripVertical
                              size={14}
                              aria-hidden="true"
                              className="ml-auto flex-none text-[#aaa39a] transition-colors group-hover:text-[#b45f45]"
                            />
                          )}
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

      <main className="relative flex min-h-[520px] flex-1 flex-col overflow-hidden bg-[#f5f0e8]">
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

        <div
          data-testid="field-drop-canvas"
          onDragEnter={(event) => {
            if (!draggedPaletteItem) return
            event.preventDefault()
            canvasDragDepth.current += 1
            setIsPaletteOverCanvas(true)
          }}
          onDragOver={(event) => {
            if (!draggedPaletteItem) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDragLeave={() => {
            if (!draggedPaletteItem) return
            canvasDragDepth.current = Math.max(0, canvasDragDepth.current - 1)
            if (canvasDragDepth.current === 0) setIsPaletteOverCanvas(false)
          }}
          onDrop={dropPaletteField}
          className={`relative flex-1 overflow-y-auto p-4 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none sm:p-6 ${
            isPaletteOverCanvas ? 'bg-[#f8ede7]' : ''
          }`}
        >
          {draggedPaletteItem && !currentPage.isFinal && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-2 z-20 rounded-xl border-2 border-dashed transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transform-none motion-reduce:transition-none ${
                isPaletteOverCanvas
                  ? 'scale-[0.995] border-[#cc785c] bg-[#cc785c]/5'
                  : 'border-[#c9b4a8] bg-white/10'
              }`}
            >
              <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-[#e2c9bf] bg-white px-3 py-1.5 text-xs font-medium text-[#a9583e] shadow-sm">
                Drop to add {draggedPaletteItem.label}
              </span>
            </div>
          )}
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
              <FormSuccessCard
                bordered
                message={currentPage.finalTemplate || 'Your response has been recorded.'}
                supportEmail={currentPage.finalContactEmail}
              />
            ) : currentPage.fields.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e6dfd8] bg-[#faf9f5] px-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efe9de] text-[#cc785c]">
                  <Plus size={18} />
                </span>
                <p className="mt-3 text-sm font-medium text-[#141413]">This page has no fields yet</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-[#8e8b82]">Click a field type or drag it here. The new field will appear and open its settings.</p>
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
                        onDelete={() => deleteFieldLocal(field.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
        <CanvasAskMenu />
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
