import {
  AlignLeft,
  FileCode2,
  Heading1,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
} from 'lucide-react'
import type { PopupElementType } from '../../lib/popup-builder/types'

/** Native drag type for palette → canvas drops (page-builder convention). */
export const POPUP_ELEMENT_DRAG_TYPE = 'application/x-ponkoform-popup-element'

const PALETTE_ITEMS: Array<{ type: PopupElementType; label: string; icon: React.ReactNode; hint: string }> = [
  { type: 'heading', label: 'Heading', icon: <Heading1 size={16} aria-hidden="true" />, hint: 'Big attention line' },
  { type: 'text', label: 'Text', icon: <AlignLeft size={16} aria-hidden="true" />, hint: 'Supporting copy' },
  { type: 'image', label: 'Image', icon: <ImageIcon size={16} aria-hidden="true" />, hint: 'Logo or photo' },
  { type: 'button', label: 'Button', icon: <MousePointerClick size={16} aria-hidden="true" />, hint: 'Links to anything' },
  { type: 'divider', label: 'Divider', icon: <Minus size={16} aria-hidden="true" />, hint: 'Separate sections' },
  { type: 'html', label: 'HTML', icon: <FileCode2 size={16} aria-hidden="true" />, hint: 'Raw embed markup' },
]

/** Left pane — draggable element chips (click adds one at the canvas center). */
export function ElementPalette({ onAdd }: { onAdd?: (type: PopupElementType) => void }) {
  return (
    <aside className="flex-none border-b border-[#e6dfd8] bg-[#faf9f5] p-4 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Elements">
      <p className="text-sm font-medium text-[#141413]">Add an element</p>
      <p className="mb-4 mt-1 text-xs leading-5 text-[#817d76]">
        Click to add, or drag an element exactly where you want it.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.type}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(POPUP_ELEMENT_DRAG_TYPE, item.type)
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => onAdd?.(item.type)}
            className="group flex min-w-0 cursor-grab items-center gap-2.5 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5 text-left transition-[transform,border-color,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:border-[#cc785c] hover:bg-[#efe9de] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] active:scale-[0.98] active:cursor-grabbing motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#efe9de] text-[#a9583e] ring-1 ring-[#e6dfd8] transition-colors duration-150 group-hover:bg-white motion-reduce:transition-none">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-[#141413]">{item.label}</span>
              <span className="block truncate text-[10px] text-[#8e8b82]">{item.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 border-t border-[#e6dfd8] pt-4 text-[10px] leading-4 text-[#8e8b82] lg:mt-6">
        Select an element on the canvas to adjust its content, size, and layer order.
      </p>
    </aside>
  )
}
