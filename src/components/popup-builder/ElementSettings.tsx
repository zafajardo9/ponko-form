import { ArrowDownToLine, ArrowUpToLine, Copy, Trash2 } from 'lucide-react'
import type { ButtonElement, PopupButtonIcon, PopupElement } from '../../lib/popup-builder/types'
import { PopupRichTextEditor } from './PopupRichTextEditor'
import { CommittedNumberInput } from './CommittedNumberInput'

/**
 * Right pane (element mode) — contextual controls for the selected element,
 * following the FieldSettings input conventions.
 */

const inputClass =
  'h-9 w-full rounded-md border border-[#dedbd5] bg-white px-2.5 text-sm text-[#141413] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15'
const textareaClass =
  'w-full resize-y rounded-md border border-[#dedbd5] bg-white px-2.5 py-2 text-sm leading-5 text-[#141413] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15'

export function ElementSettings({
  element,
  canvasWidth,
  canvasHeight,
  onChange,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
}: {
  element: PopupElement
  canvasWidth: number
  canvasHeight: number
  onChange: (patch: Partial<PopupElement>) => void
  onDelete: () => void
  onDuplicate: () => void
  onBringForward: () => void
  onSendBackward: () => void
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8e8b82]">
          {element.type} element
        </p>
        <div className="flex items-center gap-1">
          <IconAction label="Bring forward" onClick={onBringForward}>
            <ArrowUpToLine size={13} aria-hidden="true" />
          </IconAction>
          <IconAction label="Send backward" onClick={onSendBackward}>
            <ArrowDownToLine size={13} aria-hidden="true" />
          </IconAction>
          <IconAction label="Duplicate" onClick={onDuplicate}>
            <Copy size={13} aria-hidden="true" />
          </IconAction>
          <IconAction label="Delete element" danger onClick={onDelete}>
            <Trash2 size={13} aria-hidden="true" />
          </IconAction>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-2">
        <NumberField label="X" value={Math.round(element.x)} disabled={element.type === 'image' && element.widthMode === 'canvas'} onChange={(x) => onChange({ x })} />
        <NumberField label="Y" value={Math.round(element.y)} disabled={element.type === 'image' && element.heightMode === 'canvas'} onChange={(y) => onChange({ y })} />
        <NumberField label="W" value={Math.round(element.width)} min={24} disabled={element.type === 'image' && element.widthMode === 'canvas'} onChange={(width) => onChange({ width })} />
        <NumberField
          label="H"
          value={Math.round(element.height)}
          min={24}
          disabled={((element.type === 'text' || element.type === 'heading') && element.autoHeight !== false) || (element.type === 'image' && element.heightMode === 'canvas')}
          onChange={(height) => onChange(
            element.type === 'text' || element.type === 'heading'
              ? { height, autoHeight: false }
              : { height },
          )}
        />
      </div>

      {element.type === 'heading' ? (
        <>
          <Field label="Text">
            <input className={inputClass} value={element.text} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <AutoHeightControl
            checked={element.autoHeight !== false}
            onChange={(autoHeight) => onChange({ autoHeight })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Level">
              <select className={inputClass} value={element.level} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>H1</option>
                <option value={2}>H2</option>
                <option value={3}>H3</option>
              </select>
            </Field>
            <Field label="Weight">
              <select className={inputClass} value={element.fontWeight} onChange={(e) => onChange({ fontWeight: e.target.value as 'normal' | 'medium' | 'semibold' | 'bold' })}>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <NumberField value={element.fontSize} min={8} max={120} onChange={(fontSize) => onChange({ fontSize })} full />
            </Field>
            <ColorField label="Color" value={element.color} onChange={(color) => onChange({ color })} />
          </div>
          <ControlGroup label="Horizontal alignment">
            <SegmentedControl
              ariaLabel="Heading horizontal alignment"
              value={element.align}
              options={['left', 'center', 'right']}
              onChange={(align) => onChange({ align: align as 'left' | 'center' | 'right' })}
            />
          </ControlGroup>
          <ControlGroup label="Vertical alignment">
            <SegmentedControl
              ariaLabel="Heading vertical alignment"
              value={element.verticalAlign ?? 'top'}
              options={['top', 'middle', 'bottom']}
              onChange={(verticalAlign) => onChange({ verticalAlign: verticalAlign as 'top' | 'middle' | 'bottom' })}
            />
          </ControlGroup>
        </>
      ) : element.type === 'text' ? (
        <>
          <Field label="Text">
            <PopupRichTextEditor value={element.text} onChange={(text) => onChange({ text })} />
          </Field>
          <AutoHeightControl
            checked={element.autoHeight !== false}
            onChange={(autoHeight) => onChange({ autoHeight })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <NumberField value={element.fontSize} min={8} max={80} onChange={(fontSize) => onChange({ fontSize })} full />
            </Field>
            <Field label="Line height">
              <NumberField value={element.lineHeight} step={0.05} min={0.8} max={3} onChange={(lineHeight) => onChange({ lineHeight })} full />
            </Field>
          </div>
          <ColorField label="Color" value={element.color} onChange={(color) => onChange({ color })} />
          <ControlGroup label="Horizontal alignment">
            <SegmentedControl
              ariaLabel="Horizontal alignment"
              value={element.align}
              options={['left', 'center', 'right']}
              onChange={(align) => onChange({ align: align as 'left' | 'center' | 'right' })}
            />
          </ControlGroup>
          <ControlGroup label="Vertical alignment">
            <SegmentedControl
              ariaLabel="Vertical alignment"
              value={element.verticalAlign ?? 'top'}
              options={['top', 'middle', 'bottom']}
              onChange={(verticalAlign) => onChange({ verticalAlign: verticalAlign as 'top' | 'middle' | 'bottom' })}
            />
          </ControlGroup>
        </>
      ) : element.type === 'image' ? (
        <>
          <section className="flex flex-col gap-2">
            <SectionEyebrow>Canvas coverage</SectionEyebrow>
            <CanvasFillControl
              label="Full canvas width"
              detail="Pin left and right edges to the popup canvas."
              checked={element.widthMode === 'canvas'}
              onChange={(checked) => onChange(checked
                ? { widthMode: 'canvas', x: 0, width: canvasWidth }
                : { widthMode: 'fixed' })}
            />
            <CanvasFillControl
              label="Full canvas height"
              detail="Pin top and bottom edges to the popup canvas."
              checked={element.heightMode === 'canvas'}
              onChange={(checked) => onChange(checked
                ? { heightMode: 'canvas', y: 0, height: canvasHeight }
                : { heightMode: 'fixed' })}
            />
          </section>
          <Field label="Image URL">
            <input className={inputClass} value={element.src} placeholder="https://…" onChange={(e) => onChange({ src: e.target.value })} />
          </Field>
          <Field label="Alt text">
            <input className={inputClass} value={element.alt} onChange={(e) => onChange({ alt: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fit">
              <select className={inputClass} value={element.fit} onChange={(e) => onChange({ fit: e.target.value as 'cover' | 'contain' })}>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </Field>
            <Field label="Corner radius">
              <NumberField value={element.radius} min={0} max={200} onChange={(radius) => onChange({ radius })} full />
            </Field>
          </div>
        </>
      ) : element.type === 'button' ? (
        <>
          <section className="flex flex-col gap-2.5">
            <SectionEyebrow>Content &amp; action</SectionEyebrow>
            <Field label="Button label">
              <input className={inputClass} value={element.label} placeholder="Get started" onChange={(e) => onChange({ label: e.target.value })} />
            </Field>
            <Field label="Destination">
              <input
                className={inputClass}
                value={element.link}
                placeholder="https://… or /forms/your-form"
                onChange={(e) => onChange({ link: e.target.value })}
              />
            </Field>
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${element.link.trim() ? 'border-[#cfe0d2] bg-[#f2f8f3]' : 'border-[#eadac3] bg-[#fff9ef]'}`}>
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${element.link.trim() ? 'bg-[#4e8a5b]' : 'bg-[#c18a3f]'}`} aria-hidden="true" />
              <p className="text-[10px] leading-4 text-[#6c6a64]">
                {element.link.trim() ? 'Ready to open this destination.' : 'Add a destination before publishing so the button can be clicked.'}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-[#3d3d3a]">
              <input
                type="checkbox"
                checked={element.openInNewTab}
                onChange={(e) => onChange({ openInNewTab: e.target.checked })}
                className="h-4 w-4 accent-[#cc785c]"
              />
              Open in a new tab
            </label>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-[#efe9de] pt-3">
            <SectionEyebrow>Style starter</SectionEyebrow>
            <ButtonPresetPicker element={element} onSelect={(patch) => onChange(patch)} />
            <p className="text-[10px] leading-4 text-[#8e8b82]">Start with a look, then fine-tune every detail below.</p>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-[#efe9de] pt-3">
            <SectionEyebrow>Color &amp; edge</SectionEyebrow>
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Fill" value={element.bgColor} onChange={(bgColor) => onChange({ bgColor })} />
              <ColorField label="Text" value={element.textColor} onChange={(textColor) => onChange({ textColor })} />
              <ColorField label="Border" value={element.borderColor ?? element.bgColor} onChange={(borderColor) => onChange({ borderColor })} />
              <Field label="Border width">
                <NumberField value={element.borderWidth ?? 0} min={0} max={12} onChange={(borderWidth) => onChange({ borderWidth })} full />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Hover fill" value={element.hoverBgColor ?? element.bgColor} onChange={(hoverBgColor) => onChange({ hoverBgColor })} />
              <ColorField label="Hover text" value={element.hoverTextColor ?? element.textColor} onChange={(hoverTextColor) => onChange({ hoverTextColor })} />
            </div>
            <ControlGroup label="Corner shape">
              <RadiusPicker value={element.radius} onChange={(radius) => onChange({ radius })} />
            </ControlGroup>
            <Field label="Exact radius (px)">
              <NumberField value={element.radius} min={0} max={200} onChange={(radius) => onChange({ radius })} full />
            </Field>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-[#efe9de] pt-3">
            <SectionEyebrow>Typography</SectionEyebrow>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Size">
                <NumberField value={element.fontSize} min={8} max={60} onChange={(fontSize) => onChange({ fontSize })} full />
              </Field>
              <Field label="Weight">
                <select className={inputClass} value={element.fontWeight} onChange={(e) => onChange({ fontWeight: e.target.value as ButtonElement['fontWeight'] })}>
                  <option value="normal">Normal</option>
                  <option value="medium">Medium</option>
                  <option value="semibold">Semibold</option>
                  <option value="bold">Bold</option>
                </select>
              </Field>
              <Field label="Letter spacing">
                <NumberField value={element.letterSpacing ?? 0} min={-2} max={12} step={0.1} onChange={(letterSpacing) => onChange({ letterSpacing })} full />
              </Field>
              <Field label="Style">
                <select className={inputClass} value={element.fontStyle ?? 'normal'} onChange={(e) => onChange({ fontStyle: e.target.value as ButtonElement['fontStyle'] })}>
                  <option value="normal">Regular</option>
                  <option value="italic">Italic</option>
                </select>
              </Field>
            </div>
            <ControlGroup label="Capitalization">
              <SegmentedControl ariaLabel="Button capitalization" value={element.textTransform ?? 'none'} options={['none', 'uppercase']} onChange={(textTransform) => onChange({ textTransform: textTransform as ButtonElement['textTransform'] })} />
            </ControlGroup>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-[#efe9de] pt-3">
            <SectionEyebrow>Layout</SectionEyebrow>
            <ControlGroup label="Horizontal alignment">
              <SegmentedControl ariaLabel="Button horizontal alignment" value={element.textAlign ?? 'center'} options={['left', 'center', 'right']} onChange={(textAlign) => onChange({ textAlign: textAlign as ButtonElement['textAlign'] })} />
            </ControlGroup>
            <ControlGroup label="Vertical alignment">
              <SegmentedControl ariaLabel="Button vertical alignment" value={element.verticalAlign ?? 'middle'} options={['top', 'middle', 'bottom']} onChange={(verticalAlign) => onChange({ verticalAlign: verticalAlign as ButtonElement['verticalAlign'] })} />
            </ControlGroup>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Side padding">
                <NumberField value={element.paddingX ?? 16} min={0} max={80} onChange={(paddingX) => onChange({ paddingX })} full />
              </Field>
              <Field label="Top/bottom padding">
                <NumberField value={element.paddingY ?? 8} min={0} max={40} onChange={(paddingY) => onChange({ paddingY })} full />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-[#efe9de] pt-3">
            <SectionEyebrow>Icon &amp; interaction</SectionEyebrow>
            <Field label="Icon">
              <select className={inputClass} value={element.icon ?? 'none'} onChange={(e) => onChange({ icon: e.target.value as PopupButtonIcon })}>
                <option value="none">No icon</option>
                <option value="arrow-right">Arrow right</option>
                <option value="external-link">External link</option>
                <option value="mail">Mail</option>
                <option value="sparkles">Sparkles</option>
              </select>
            </Field>
            {(element.icon ?? 'none') !== 'none' ? (
              <ControlGroup label="Icon position">
                <SegmentedControl ariaLabel="Button icon position" value={element.iconPosition ?? 'right'} options={['left', 'right']} onChange={(iconPosition) => onChange({ iconPosition: iconPosition as ButtonElement['iconPosition'] })} />
              </ControlGroup>
            ) : null}
            <ControlGroup label="Shadow">
              <SegmentedControl ariaLabel="Button shadow" value={element.shadow ?? 'none'} options={['none', 'soft', 'strong']} onChange={(shadow) => onChange({ shadow: shadow as ButtonElement['shadow'] })} />
            </ControlGroup>
            <ControlGroup label="Hover effect">
              <SegmentedControl ariaLabel="Button hover effect" value={element.hoverEffect ?? 'none'} options={['none', 'lift', 'glow']} onChange={(hoverEffect) => onChange({ hoverEffect: hoverEffect as ButtonElement['hoverEffect'] })} />
            </ControlGroup>
          </section>
        </>
      ) : element.type === 'divider' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Thickness">
              <NumberField value={element.thickness} min={1} max={40} onChange={(thickness) => onChange({ thickness })} full />
            </Field>
            <ColorField label="Color" value={element.color} onChange={(color) => onChange({ color })} />
          </div>
          <Field label="Style">
            <select className={inputClass} value={element.lineStyle} onChange={(e) => onChange({ lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted' })}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </Field>
        </>
      ) : (
        <Field label="HTML — raw markup, iframes allowed">
          <textarea
            rows={8}
            className={`${textareaClass} font-mono text-xs`}
            value={element.html}
            onChange={(e) => onChange({ html: e.target.value })}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-[#efe9de] pt-3">
        <Field label={`Opacity (${Math.round(element.opacity * 100)}%)`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={element.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
            className="w-full accent-[#cc785c]"
          />
        </Field>
        <Field label="Rotation (°)">
          <NumberField value={element.rotation} min={-360} max={360} onChange={(rotation) => onChange({ rotation })} full />
        </Field>
      </div>
    </div>
  )
}

// ── Small form primitives ──

const BUTTON_PRESETS: Array<{
  id: string
  label: string
  patch: Partial<ButtonElement>
}> = [
  {
    id: 'brand',
    label: 'Brand',
    patch: { bgColor: '#cc785c', textColor: '#ffffff', borderColor: '#a9583e', borderWidth: 0, radius: 10, shadow: 'soft', hoverBgColor: '#a9583e', hoverTextColor: '#ffffff', hoverEffect: 'lift' },
  },
  {
    id: 'ink',
    label: 'Ink',
    patch: { bgColor: '#141413', textColor: '#ffffff', borderColor: '#141413', borderWidth: 0, radius: 8, shadow: 'strong', hoverBgColor: '#343431', hoverTextColor: '#ffffff', hoverEffect: 'lift' },
  },
  {
    id: 'outline',
    label: 'Outline',
    patch: { bgColor: '#ffffff', textColor: '#141413', borderColor: '#3d3d3a', borderWidth: 1, radius: 10, shadow: 'none', hoverBgColor: '#f5f2ed', hoverTextColor: '#141413', hoverEffect: 'none' },
  },
  {
    id: 'soft',
    label: 'Soft',
    patch: { bgColor: '#f5ece4', textColor: '#8a4934', borderColor: '#ead4c8', borderWidth: 1, radius: 14, shadow: 'none', hoverBgColor: '#eddccf', hoverTextColor: '#713b2b', hoverEffect: 'glow' },
  },
]

function ButtonPresetPicker({ element, onSelect }: { element: ButtonElement; onSelect: (patch: Partial<ButtonElement>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Button style starters">
      {BUTTON_PRESETS.map((preset) => {
        const active = element.bgColor === preset.patch.bgColor
          && element.textColor === preset.patch.textColor
          && (element.borderWidth ?? 0) === preset.patch.borderWidth
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(preset.patch)}
            className={`rounded-lg border p-2 text-left transition-[border-color,background-color,box-shadow] duration-150 motion-reduce:transition-none ${active ? 'border-[#cc785c] bg-[#fffaf7] shadow-[0_0_0_1px_rgba(204,120,92,0.15)]' : 'border-[#dedbd5] bg-white hover:border-[#c9c3ba] hover:bg-[#fffdfa]'}`}
          >
            <span
              className="flex h-8 items-center justify-center px-2 text-[10px] font-semibold"
              style={{
                backgroundColor: preset.patch.bgColor,
                color: preset.patch.textColor,
                borderColor: preset.patch.borderColor,
                borderWidth: preset.patch.borderWidth,
                borderStyle: 'solid',
                borderRadius: Math.min(preset.patch.radius ?? 0, 12),
                boxShadow: preset.patch.shadow === 'strong' ? '0 7px 14px rgb(20 20 19 / 0.2)' : preset.patch.shadow === 'soft' ? '0 4px 10px rgb(20 20 19 / 0.12)' : 'none',
              }}
            >
              Aa
            </span>
            <span className="mt-1.5 block text-[10px] font-medium text-[#55514b]">{preset.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function RadiusPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const options = [
    { label: 'Square', value: 0 },
    { label: 'Soft', value: 8 },
    { label: 'Round', value: 16 },
    { label: 'Pill', value: 999 },
  ]
  return (
    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Button corner shape">
      {options.map((option) => {
        const active = option.value === 999 ? value >= 100 : value === option.value
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value === 999 ? 200 : option.value)}
            className={`flex h-12 flex-col items-center justify-center gap-1 rounded-md border text-[9px] font-medium transition-colors motion-reduce:transition-none ${active ? 'border-[#cc785c] bg-[#fffaf7] text-[#a9583e]' : 'border-[#dedbd5] bg-white text-[#6c6a64] hover:bg-[#faf9f5]'}`}
          >
            <span className="block h-3.5 w-8 border border-current" style={{ borderRadius: option.value }} aria-hidden="true" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8e8b82]">{children}</p>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
      {label}
      {children}
    </label>
  )
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
      <span>{label}</span>
      {children}
    </div>
  )
}

function AutoHeightControl({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-[#e6dfd8] bg-[#f7f3ed] px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[#3d3d3a]">Auto height</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-[#817d76]">Grow the box as text wraps.</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#cc785c]"
      />
    </label>
  )
}

function CanvasFillControl({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string
  detail: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-[#e6dfd8] bg-[#f7f3ed] px-3 py-2.5">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[#3d3d3a]">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-[#817d76]">{detail}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#cc785c]"
      />
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
      {label}
      <span className="group relative flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-[#dedbd5] bg-white px-1.5 transition-[border-color,box-shadow,background-color] duration-150 hover:border-[#c9c3ba] hover:bg-[#fffdfa] focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/15 motion-reduce:transition-none">
        <span
          className="h-6 w-7 shrink-0 rounded-[5px] border border-black/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#55514b]">
          {value}
        </span>
        <span className="h-3.5 w-3.5 rounded-full border border-[#d5cfc7] bg-[conic-gradient(from_45deg,#cc785c,#e9b95e,#74a884,#6f87c8,#a76ca8,#cc785c)] opacity-70 transition-transform duration-150 group-hover:rotate-45 motion-reduce:transition-none" aria-hidden="true" />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} color picker`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  full,
  disabled,
}: {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  full?: boolean
  disabled?: boolean
}) {
  const input = (
    <CommittedNumberInput
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onCommit={onChange}
      className={`${inputClass} disabled:cursor-not-allowed disabled:bg-[#f3f0eb] disabled:text-[#9a958d] ${full ? '' : 'h-8 px-2 text-xs'}`}
    />
  )
  return label ? (
    <Field label={label}>{input}</Field>
  ) : (
    input
  )
}

function SegmentedControl({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-[#dedbd5] bg-white" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`h-9 flex-1 capitalize transition-colors first:rounded-l-md last:rounded-r-md motion-reduce:transition-none ${
            value === option ? 'bg-[#f5ece4] font-semibold text-[#a9583e]' : 'text-[#6c6a64] hover:bg-[#faf9f5]'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
        danger ? 'text-[#b33e35] hover:bg-[#fdf0f0]' : 'text-[#6c6a64] hover:bg-[#f5f0e8] hover:text-[#141413]'
      }`}
    >
      {children}
    </button>
  )
}
