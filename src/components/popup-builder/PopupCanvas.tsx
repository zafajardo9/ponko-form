import { useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { PopupRuntime } from '../popup-runtime/PopupRuntime'
import { clampToCanvas, snapRectToAlignmentGuides, type PopupAlignmentGuides } from '../../lib/popup-builder/runtime'
import { createElement, duplicateElement } from '../../lib/popup-builder/defaults'
import type { PopupElement, PopupStyle } from '../../lib/popup-builder/types'
import { POPUP_ELEMENT_DRAG_TYPE } from './ElementPalette'
import { popupRichTextHtml } from '../../lib/popup-builder/sanitize'

/**
 * PopupCanvas — the builder's center pane.
 *
 * Renders the real PopupRuntime (live WYSIWYG) with a transparent
 * interaction layer on top: hit-boxes per element handle select / drag (8px
 * grid + smart alignment snap) / corner-resize; the empty area deselects and
 * accepts palette drops.
 */
export function PopupCanvas({
  width,
  height,
  style,
  elements,
  selectedId,
  onSelect,
  onChangeElements,
}: {
  width: number
  height: number
  style: PopupStyle
  elements: PopupElement[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChangeElements: (updater: (current: PopupElement[]) => PopupElement[]) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dropHint, setDropHint] = useState(false)
  const [alignmentGuides, setAlignmentGuides] = useState<PopupAlignmentGuides>({})

  type DragState =
    | { kind: 'move'; id: string; startX: number; startY: number; originX: number; originY: number }
    | { kind: 'resize'; id: string; startX: number; startY: number; originW: number; originH: number }
  const dragRef = useRef<DragState | null>(null)

  // Keep auto-height text and heading boxes synchronized with their real wrapped content.
  // The persisted height then drives both the builder and the public embed.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !elements.some((element) =>
      (element.type === 'text' || element.type === 'heading') && element.autoHeight !== false,
    )) return

    const fontStacks = {
      sans: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      serif: '"Cormorant Garamond", "Times New Roman", serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
    }
    const measurer = document.createElement('div')
    Object.assign(measurer.style, {
      position: 'absolute',
      left: '-10000px',
      top: '0',
      height: 'auto',
      minHeight: '0',
      padding: '0',
      border: '0',
      boxSizing: 'border-box',
      visibility: 'hidden',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      fontFamily: fontStacks[style.fontFamily ?? 'sans'],
    })
    canvas.appendChild(measurer)

    const measuredHeights = new Map<string, number>()
    for (const element of elements) {
      if ((element.type !== 'text' && element.type !== 'heading') || element.autoHeight === false) continue
      measurer.style.width = `${element.width}px`
      measurer.style.fontSize = `${element.fontSize}px`
      measurer.style.lineHeight = element.type === 'heading' ? '1.2' : String(element.lineHeight)
      measurer.style.fontWeight = element.type === 'heading'
        ? String({ normal: 400, medium: 500, semibold: 600, bold: 700 }[element.fontWeight])
        : '400'
      if (element.type === 'text') {
        measurer.className = 'popup-rich-text'
        measurer.innerHTML = popupRichTextHtml(element.text)
      } else {
        measurer.className = ''
        measurer.textContent = element.text || '\u200b'
      }
      const availableHeight = Math.max(24, height - element.y)
      measuredHeights.set(element.id, Math.min(availableHeight, Math.max(24, Math.ceil(measurer.scrollHeight))))
    }
    measurer.remove()

    if (!elements.some((element) => measuredHeights.has(element.id) && measuredHeights.get(element.id) !== element.height)) return
    onChangeElements((current) => current.map((element) => {
      const measuredHeight = measuredHeights.get(element.id)
      return measuredHeight == null || measuredHeight === element.height
        ? element
        : { ...element, height: measuredHeight }
    }))
  }, [elements, height, onChangeElements, style.fontFamily])

  function canvasPoint(event: { clientX: number; clientY: number }) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  // ── Palette drops ──

  function handleDragOver(event: ReactDragEvent) {
    if (!event.dataTransfer.types.includes(POPUP_ELEMENT_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropHint(true)
  }

  function handleDrop(event: ReactDragEvent) {
    const type = event.dataTransfer.getData(POPUP_ELEMENT_DRAG_TYPE) as PopupElement['type'] | ''
    setDropHint(false)
    if (!type) return
    event.preventDefault()

    const point = canvasPoint(event)
    const nextIndex = elements.length
    const created = createElement(type, nextIndex + 1)
    const raw = { ...created, x: point.x - created.width / 2, y: point.y - created.height / 2 }
    const aligned = snapRectToAlignmentGuides(raw, { width, height }, elements)
    const snapped = {
      x: aligned.guides.vertical == null ? Math.round(Math.max(0, raw.x) / 8) * 8 : aligned.rect.x,
      y: aligned.guides.horizontal == null ? Math.round(Math.max(0, raw.y) / 8) * 8 : aligned.rect.y,
    }
    const clamped = clampToCanvas({ ...created, ...snapped }, { width, height })
    onChangeElements((current) => [...current, { ...created, ...clamped }])
    onSelect(created.id)
  }

  // ── Move / resize via pointer events ──

  function beginMove(event: ReactPointerEvent, element: PopupElement) {
    if (event.button !== 0) return
    event.stopPropagation()
    onSelect(element.id)
    setAlignmentGuides({})
    const point = canvasPoint(event)
    dragRef.current = {
      kind: 'move',
      id: element.id,
      startX: point.x,
      startY: point.y,
      originX: element.x,
      originY: element.y,
    }
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  function beginResize(event: ReactPointerEvent, element: PopupElement) {
    if (event.button !== 0) return
    event.stopPropagation()
    setAlignmentGuides({})
    const point = canvasPoint(event)
    dragRef.current = {
      kind: 'resize',
      id: element.id,
      startX: point.x,
      startY: point.y,
      originW: element.width,
      originH: element.height,
    }
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const point = canvasPoint(event)
    const dx = point.x - drag.startX
    const dy = point.y - drag.startY

    if (drag.kind === 'move') {
      const moving = elements.find((element) => element.id === drag.id)
      if (!moving) return
      const raw = {
        ...moving,
        x: moving.type === 'image' && moving.widthMode === 'canvas' ? 0 : drag.originX + dx,
        y: moving.type === 'image' && moving.heightMode === 'canvas' ? 0 : drag.originY + dy,
      }
      const aligned = snapRectToAlignmentGuides(
        raw,
        { width, height },
        elements.filter((element) => element.id !== drag.id),
      )
      setAlignmentGuides(aligned.guides)
      const snapped = clampToCanvas(
        {
          ...moving,
          x: aligned.guides.vertical == null ? Math.round(raw.x / 8) * 8 : aligned.rect.x,
          y: aligned.guides.horizontal == null ? Math.round(raw.y / 8) * 8 : aligned.rect.y,
        },
        { width, height },
      )
      onChangeElements((current) => current.map((element) =>
        element.id === drag.id ? { ...element, ...snapped } : element,
      ))
      return
    }

    onChangeElements((current) =>
      current.map((element) => {
        if (element.id !== drag.id) return element
        return {
          ...element,
          ...(element.type === 'text' || element.type === 'heading' ? { autoHeight: false } : {}),
          ...clampToCanvas(
            {
              ...element,
              width: element.type === 'image' && element.widthMode === 'canvas'
                ? width
                : Math.round((drag.originW + dx) / 4) * 4,
              height: element.type === 'image' && element.heightMode === 'canvas'
                ? height
                : Math.round((drag.originH + dy) / 4) * 4,
            },
            { width, height },
          ),
        }
      }),
    )
  }

  function endPointerDrag() {
    dragRef.current = null
    setAlignmentGuides({})
  }

  function duplicateSelected() {
    const selected = elements.find((element) => element.id === selectedId)
    if (!selected) return
    const copy = duplicateElement(selected)
    const clamped = clampToCanvas(copy, { width, height })
    onChangeElements((current) => [...current, { ...copy, ...clamped }])
    onSelect(copy.id)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!selectedId) return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      event.preventDefault()
      onChangeElements((current) => current.filter((element) => element.id !== selectedId))
      onSelect(null)
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateSelected()
    }
  }

  return (
    <div
      className="relative flex min-h-[520px] min-w-0 flex-1 items-start justify-center overflow-auto bg-[#f5f0e8] p-4 focus-visible:outline-none sm:p-6 lg:min-h-0"
      style={{
        backgroundImage: 'radial-gradient(#d9d0c5 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Popup canvas"
    >
      <div
        ref={canvasRef}
        className={`relative shrink-0 shadow-[0_10px_30px_rgba(36,35,32,0.14)] transition-shadow ${
          dropHint ? 'ring-2 ring-[#cc785c]' : ''
        }`}
        style={{ width, height }}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropHint(false)}
        onDrop={handleDrop}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelect(null)
        }}
      >
        {/* WYSIWYG content (non-interactive) */}
        <div className="pointer-events-none absolute inset-0">
          <PopupRuntime
            publicId="builder"
            width={width}
            height={height}
            style={style}
            elements={elements}
            mode="builder"
          />
        </div>

        {/* Smart guides sit above content but below the interaction handles. */}
        {alignmentGuides.vertical != null ? (
          <span
            data-snap-guide="vertical"
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-[90] w-px bg-[#cc785c] shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
            style={{ left: alignmentGuides.vertical }}
          />
        ) : null}
        {alignmentGuides.horizontal != null ? (
          <span
            data-snap-guide="horizontal"
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-[90] h-px bg-[#cc785c] shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
            style={{ top: alignmentGuides.horizontal }}
          />
        ) : null}
        {alignmentGuides.vertical === width / 2 && alignmentGuides.horizontal === height / 2 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2 z-[91] -translate-x-1/2 rounded-full border border-white bg-[#cc785c] px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm"
            style={{ left: width / 2 }}
          >
            Center
          </span>
        ) : null}

        {/* Interaction layer */}
        {elements.map((element) => {
          const selected = element.id === selectedId
          return (
            <div
              key={element.id}
              onPointerDown={(event) => beginMove(event, element)}
              onPointerMove={handlePointerMove}
              onPointerUp={endPointerDrag}
              onPointerCancel={endPointerDrag}
              className={`absolute cursor-move rounded-[3px] outline-2 outline-offset-0 transition-[outline-color] ${
                selected ? 'outline-[#cc785c]' : 'outline-transparent hover:outline-[#cc785c]/40'
              }`}
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                zIndex: 100 + element.zIndex,
                opacity: element.opacity,
                transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                touchAction: 'none',
              }}
              aria-label={`${element.type} element`}
            >
              {selected ? (
                <>
                  <span
                    className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-[#cc785c]"
                    onPointerDown={(event) => beginResize(event, element)}
                    aria-label="Resize element"
                    style={{ touchAction: 'none' }}
                  />
                  <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-[#141413] px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {element.type}
                  </span>
                </>
              ) : null}
            </div>
          )
        })}

        {elements.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="rounded-lg bg-white/85 px-4 py-3 text-sm text-[#6c6a64]">
              Drag elements from the left, or click one to drop it here.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
