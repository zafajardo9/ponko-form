import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  ChevronUp,
  Code2,
  ExternalLink,
  Eye,
  MousePointerClick,
  Save,
  Settings2,
  SquareStack,
} from 'lucide-react'
import {
  deletePopup,
  getPopup,
  savePopup,
  setPopupStatus,
} from '../../lib/server-fns/popups'
import { clampCanvasSize, clampToCanvas } from '../../lib/popup-builder/runtime'
import { createElement, duplicateElement } from '../../lib/popup-builder/defaults'
import type {
  PopupElement,
  PopupFrequency,
  PopupPlacement,
  PopupSchedule,
  PopupStyle,
  PopupTriggerConfig,
} from '../../lib/popup-builder/types'
import { Button, navigationBackIconClass, navigationButtonClass } from '../ui/Button'
import { AppLogo } from '../ui/AppLogo'
import { Badge } from '../ui/Badge'
import { useToast } from '../ui/Toast'
import { UserMenu } from '../auth/UserMenu'
import { appConfig } from '../../utils/app-config'
import { ElementPalette } from './ElementPalette'
import { PopupCanvas } from './PopupCanvas'
import { ElementSettings } from './ElementSettings'
import { PopupSettings } from './PopupSettings'
import { SharePopupDialog } from './SharePopupDialog'

/**
 * PopupBuilderWorkspace — the three-pane popup editor.
 *
 * Left: element palette. Center: WYSIWYG free-position canvas. Right:
 * contextual element settings or popup-level settings. Every edit marks the
 * workspace dirty and schedules a debounced whole-config save, mirroring the
 * page builder's `onChanged` flow.
 */

const AUTOSAVE_DELAY_MS = 900

interface PopupDraft {
  title: string
  width: number
  height: number
  placement: PopupPlacement
  trigger: PopupTriggerConfig
  frequency: PopupFrequency
  schedule: PopupSchedule
  style: PopupStyle
  elements: PopupElement[]
}

export function PopupBuilderWorkspace({ popupId }: { popupId: number }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const popupQuery = useQuery({
    queryKey: ['popup', popupId],
    queryFn: () => getPopup({ data: { id: popupId } }),
    enabled: Number.isFinite(popupId),
  })
  const popup = popupQuery.data

  const [draft, setDraft] = useState<PopupDraft | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'element' | 'popup'>('popup')
  const [embedOpen, setEmbedOpen] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const latestDraft = useRef<PopupDraft | null>(null)
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())

  // Load the persisted popup into the draft once.
  useEffect(() => {
    if (!popup || draft) return
    const initial: PopupDraft = {
      title: popup.title,
      width: popup.width,
      height: popup.height,
      placement: popup.placement,
      trigger: popup.trigger,
      frequency: popup.frequency,
      schedule: popup.schedule ?? {},
      style: popup.style ?? {},
      elements: popup.elements ?? [],
    }
    setDraft(initial)
    setSavedSnapshot(JSON.stringify(initial))
  }, [popup, draft])

  const isDirty = draft != null && savedSnapshot != null && JSON.stringify(draft) !== savedSnapshot

  useEffect(() => {
    latestDraft.current = draft
  }, [draft])

  const saveMutation = useMutation({
    mutationFn: (payload: PopupDraft) => {
      const request = () => savePopup({
        data: {
          id: popupId,
          title: payload.title,
          width: payload.width,
          height: payload.height,
          placement: payload.placement,
          trigger: payload.trigger,
          frequency: payload.frequency,
          schedule: payload.schedule,
          style: payload.style,
          elements: payload.elements,
        },
      })
      saveChain.current = saveChain.current.catch(() => undefined).then(request)
      return saveChain.current
    },
    onSuccess: (_saved, payload) => {
      setSavedSnapshot(JSON.stringify(payload))
      queryClient.setQueryData(['popup', popupId], (current: typeof popup) =>
        current ? { ...current, ...payload, updatedAt: new Date() } : current,
      )
    },
    onError: (error) => {
      toast.error('Could not save', (error as Error).message)
    },
  })

  // Debounced autosave.
  const saveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!isDirty || !draft) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveMutation.mutate(draft), AUTOSAVE_DELAY_MS)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, isDirty])

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    const pending = latestDraft.current
    if (pending && pending.title.trim()) {
      void savePopup({ data: { id: popupId, ...pending } }).catch(() => undefined)
    }
  }, [popupId])

  const publishMutation = useMutation({
    mutationFn: (status: 'draft' | 'published') => setPopupStatus({ data: { id: popupId, status } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['popup', popupId] })
      await queryClient.invalidateQueries({ queryKey: ['popups'] })
    },
  })

  const updateDraft = useCallback((patch: Partial<PopupDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }, [])

  async function flushDraft() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    const pending = latestDraft.current
    if (!pending) return
    if (!pending.title.trim()) throw new Error('Give this popup a title before saving.')
    if (JSON.stringify(pending) !== savedSnapshot) await saveMutation.mutateAsync(pending)
  }

  async function leaveBuilder(path = '/popups') {
    try {
      await flushDraft()
      window.location.assign(path)
    } catch (error) {
      toast.error('Could not save', (error as Error).message)
    }
  }

  async function previewPopup() {
    const previewWindow = window.open('about:blank', '_blank')
    if (previewWindow) previewWindow.opener = null
    try {
      await flushDraft()
      if (previewWindow) previewWindow.location.href = `/popups/${popup?.publicId}/preview`
      else window.location.assign(`/popups/${popup?.publicId}/preview`)
    } catch (error) {
      previewWindow?.close()
      toast.error('Preview unavailable', (error as Error).message)
    }
  }

  async function changeStatus(status: 'draft' | 'published') {
    try {
      await flushDraft()
      await publishMutation.mutateAsync(status)
      toast.success(status === 'published' ? 'Popup published' : 'Popup unpublished')
    } catch (error) {
      toast.error('Could not update popup', (error as Error).message)
    }
  }

  const updateElements = useCallback((updater: (current: PopupElement[]) => PopupElement[]) => {
    setDraft((current) => (current ? { ...current, elements: updater(current.elements) } : current))
  }, [])

  const selectedElement = useMemo(
    () => draft?.elements.find((element) => element.id === selectedId) ?? null,
    [draft, selectedId],
  )

  function selectElement(id: string | null) {
    setSelectedId(id)
    setRightTab(id ? 'element' : 'popup')
  }

  function addFromPalette(type: PopupElement['type']) {
    if (!draft) return
    const created = createElement(type, draft.elements.length + 1)
    const clamped = {
      ...created,
      x: Math.max(0, Math.round((draft.width - created.width) / 2)),
      y: Math.min(Math.max(0, draft.height - created.height - 16), 24 + draft.elements.length * 12),
    }
    updateElements((current) => [...current, clamped])
    selectElement(created.id)
  }

  function patchSelected(patch: Partial<PopupElement>) {
    if (!selectedElement) return
    updateElements((current) =>
      current.map((element) => (element.id === selectedElement.id ? ({ ...element, ...patch } as PopupElement) : element)),
    )
  }

  function duplicateSelected() {
    if (!selectedElement || !draft) return
    const copy = duplicateElement(selectedElement)
    updateElements((current) => [...current, copy])
    selectElement(copy.id)
  }

  function deleteSelected() {
    if (!selectedElement) return
    updateElements((current) => current.filter((element) => element.id !== selectedElement.id))
    selectElement(null)
  }

  function bringSelectedForward() {
    if (!selectedElement) return
    updateElements((current) =>
      current.map((element) =>
        element.id === selectedElement.id ? { ...element, zIndex: Math.min(999, element.zIndex + 1) } : element,
      ),
    )
  }

  function sendSelectedBackward() {
    if (!selectedElement) return
    updateElements((current) =>
      current.map((element) =>
        element.id === selectedElement.id ? { ...element, zIndex: Math.max(0, element.zIndex - 1) } : element,
      ),
    )
  }

  async function removePopup() {
    if (!popup || !confirm(`Delete "${popup.title}"? This cannot be undone.`)) return
    await deletePopup({ data: { id: popupId } })
    window.location.assign('/popups')
  }

  if (popupQuery.isLoading) {
    return (
      <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f0e8]" role="status">
        <div className="flex h-16 items-center border-b border-[#ded8cf] bg-[#faf9f5] px-4">
          <div className="h-8 w-56 animate-pulse rounded-md bg-[#ece6dd] motion-reduce:animate-none" />
        </div>
        <div className="grid flex-1 place-items-center text-sm text-[#8e8b82]">Preparing popup editor…</div>
      </main>
    )
  }

  if (popupQuery.isError || !popup || !draft) {
    return (
      <main className="grid h-dvh place-items-center bg-[#f5f0e8] px-6 py-16">
        <div className="mx-auto max-w-md rounded-xl border border-[#e3c5bd] bg-[#fff7f5] p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-[#141413]">Popup not found</h1>
          <p className="mt-2 text-sm text-[#6c6a64]">
            It may have been deleted, or it belongs to another account.
          </p>
          <Link to="/popups" className={navigationButtonClass} onClick={(event) => { event.preventDefault(); void leaveBuilder() }}>
            <ArrowLeft size={15} className={navigationBackIconClass} aria-hidden="true" />
            Back to popups
          </Link>
        </div>
      </main>
    )
  }

  const published = popup.status === 'published'
  return (
    <main className="t-popup-page t-popup-page-editor flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f0e8]">
      <div
        id="popup-editor-toolbar"
        className="z-40 flex flex-none flex-wrap items-center border-b border-[#ded8cf] bg-[#faf9f5]/98 px-3 shadow-[0_2px_10px_rgba(20,20,19,0.045)] backdrop-blur-sm sm:px-4"
      >
        <div className="flex h-16 min-w-0 flex-1 items-center gap-2.5">
          <Link
            to="/"
            aria-label={`${appConfig.name} home`}
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
          >
            <AppLogo className="h-7 w-7 rounded-lg" fallbackClassName="bg-[#cc785c] text-sm font-bold text-white" />
            <span className="hidden text-sm font-semibold tracking-tight text-[#141413] 2xl:inline">{appConfig.name}</span>
          </Link>

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[#ded8cf]" />

          <Link
            to="/popups"
            aria-label="Back to popups"
            title="Back to popups"
            className={`${navigationButtonClass} h-8 flex-none px-2 sm:px-2.5`}
            onClick={(event) => { event.preventDefault(); void leaveBuilder() }}
          >
            <ArrowLeft size={15} className={navigationBackIconClass} aria-hidden="true" />
            <span className="hidden sm:inline">Popups</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              aria-label="Popup title"
              aria-invalid={!draft.title.trim()}
              maxLength={255}
              className="h-9 min-w-0 w-36 truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-[#141413] outline-none transition-[border-color,background-color,box-shadow] hover:border-[#dedbd5] focus:border-[#cc785c] focus:bg-white focus:ring-2 focus:ring-[#cc785c]/15 sm:w-52"
            />
            <Badge variant={popup.status}>{popup.status}</Badge>
          </div>
        </div>

        <div
          id="popup-toolbar-actions"
          aria-hidden={headerCollapsed}
          inert={headerCollapsed}
          className={`order-3 grid w-full overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none xl:order-none xl:ml-auto xl:w-auto ${
            headerCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className={`flex items-center justify-between gap-2 border-t border-[#e6dfd8] py-2 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none xl:border-t-0 xl:py-0 ${headerCollapsed ? '-translate-y-1' : 'translate-y-0'}`}>
              <div className="hidden items-center gap-3 px-1 text-xs text-[#6c6a64] md:flex">
                <span className="inline-flex items-center gap-1" title="Views"><Eye size={13} aria-hidden="true" /> {popup.viewCount}</span>
                <span className="inline-flex items-center gap-1" title="Clicks"><MousePointerClick size={13} aria-hidden="true" /> {popup.clickCount}</span>
                <span className={`font-medium ${saveMutation.isPending ? 'text-[#8e8b82]' : isDirty ? 'text-[#cc785c]' : 'text-[#2f7d52]'}`} role="status">
                  {saveMutation.isPending ? 'Saving…' : isDirty ? 'Unsaved' : 'Saved'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!isDirty || saveMutation.isPending || !draft.title.trim()}
                  onClick={() => saveMutation.mutate(draft)}
                  className="flex-none"
                >
                  {saveMutation.isPending ? 'Saving…' : isDirty ? <span className="inline-flex items-center gap-1.5"><Save size={14} /> Save changes</span> : <span className="inline-flex items-center gap-1.5"><Check size={14} /> Saved</span>}
                </Button>
                <button type="button" onClick={() => void previewPopup()} className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#ded8cf] bg-white px-2.5 text-sm text-[#5f5b55] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30">
                  <ExternalLink size={14} aria-hidden="true" /><span className="hidden sm:inline">Preview</span>
                </button>
                <button type="button" onClick={() => setEmbedOpen(true)} className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#ded8cf] bg-white px-2.5 text-sm text-[#5f5b55] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30">
                  <Code2 size={14} aria-hidden="true" /><span className="hidden 2xl:inline">Embed</span>
                </button>
                <button type="button" onClick={() => void removePopup()} aria-label="Delete popup" title="Delete popup" className="inline-flex h-8 flex-none items-center rounded-md border border-[#ded8cf] bg-white px-2.5 text-sm text-[#b33e35] transition-colors hover:bg-[#fdf0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545]/30">
                  Delete
                </button>
                <Button type="button" size="sm" variant={published ? 'secondary' : 'primary'} onClick={() => void changeStatus(published ? 'draft' : 'published')} disabled={publishMutation.isPending || saveMutation.isPending || !draft.title.trim()} className="flex-none">
                  {published ? 'Unpublish' : 'Publish'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHeaderCollapsed((collapsed) => !collapsed)}
            aria-label={headerCollapsed ? 'Show editor toolbar' : 'Minimize editor toolbar'}
            aria-controls="popup-toolbar-actions"
            aria-expanded={!headerCollapsed}
            className="group flex h-8 w-8 items-center justify-center rounded-md border border-[#ded8cf] bg-white text-[#6c6a64] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-1"
          >
            <ChevronUp size={15} aria-hidden="true" className={`transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${headerCollapsed ? 'rotate-180' : 'rotate-0'}`} />
          </button>
          <span className="hidden h-5 w-px bg-[#ded8cf] sm:block" aria-hidden="true" />
          <UserMenu />
        </div>
      </div>

      {!draft.title.trim() ? (
        <div role="alert" className="flex-none border-b border-[#f0c2b8] bg-[#fff3ef] px-4 py-2 text-sm text-[#c64545]">
          Give this popup a title before saving or publishing.
        </div>
      ) : null}

      {/* Focused three-pane workspace, shared with the Forms editor layout. */}
      <div className="flex flex-1 flex-col overflow-y-auto lg:min-h-0 lg:flex-row lg:overflow-hidden">
        <ElementPalette onAdd={addFromPalette} />

        <PopupCanvas
          width={draft.width}
          height={draft.height}
          style={draft.style}
          elements={draft.elements}
          selectedId={selectedId}
          onSelect={selectElement}
          onChangeElements={updateElements}
        />

        <aside className="flex w-full flex-none flex-col border-t border-[#e6dfd8] bg-[#faf9f5] p-4 lg:w-[340px] lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Settings panel">
          <div className="mb-4">
            <p className="text-sm font-medium text-[#141413]">Customize</p>
            <p className="mt-1 text-xs leading-5 text-[#817d76]">Tune the popup or the currently selected element.</p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-[#ddd5cc] bg-[#f3eee6] p-0.5">
            <button
              type="button"
              onClick={() => setRightTab('popup')}
              aria-pressed={rightTab === 'popup'}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none ${
                rightTab === 'popup' ? 'bg-white text-[#141413] shadow-sm' : 'text-[#6c6a64] hover:text-[#141413]'
              }`}
            >
              <Settings2 size={13} aria-hidden="true" /> Popup
            </button>
            <button
              type="button"
              onClick={() => setRightTab('element')}
              aria-pressed={rightTab === 'element'}
              disabled={!selectedElement}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-[background-color,color,box-shadow] duration-150 disabled:opacity-40 motion-reduce:transition-none ${
                rightTab === 'element' ? 'bg-white text-[#141413] shadow-sm' : 'text-[#6c6a64] hover:text-[#141413]'
              }`}
            >
              <SquareStack size={13} aria-hidden="true" /> Element
            </button>
          </div>

          <div className="min-h-0 flex-1 pr-0.5 lg:overflow-y-auto">
            {rightTab === 'element' && selectedElement ? (
              <ElementSettings
                element={selectedElement}
                onChange={patchSelected}
                onDelete={deleteSelected}
                onDuplicate={duplicateSelected}
                onBringForward={bringSelectedForward}
                onSendBackward={sendSelectedBackward}
              />
            ) : (
              <PopupSettings
                width={draft.width}
                height={draft.height}
                placement={draft.placement}
                trigger={draft.trigger}
                frequency={draft.frequency}
                schedule={draft.schedule}
                style={draft.style}
                onChange={(patch) => {
                  if (patch.width != null || patch.height != null) {
                    const size = clampCanvasSize(patch.width ?? draft.width, patch.height ?? draft.height)
                    updateDraft({
                      ...size,
                      elements: draft.elements.map((element) => ({
                        ...element,
                        ...clampToCanvas(element, size),
                      })),
                    })
                  }
                  const { width: _w, height: _h, ...rest } = patch
                  if (Object.keys(rest).length > 0) updateDraft(rest)
                }}
              />
            )}
          </div>
        </aside>
      </div>

      {embedOpen ? (
        <SharePopupDialog
          publicId={popup.publicId}
          title={draft.title || popup.title}
          published={published}
          onClose={() => setEmbedOpen(false)}
        />
      ) : null}
    </main>
  )
}
