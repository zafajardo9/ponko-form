import type {
  PopupFrequency,
  PopupPlacement,
  PopupSchedule,
  PopupStyle,
  PopupTriggerConfig,
} from '../../lib/popup-builder/types'
import {
  POPUP_MAX_HEIGHT,
  POPUP_MAX_WIDTH,
  POPUP_MIN_HEIGHT,
  POPUP_MIN_WIDTH,
} from '../../lib/popup-builder/defaults'
import { CommittedNumberInput } from './CommittedNumberInput'

/**
 * Right pane (popup mode) — canvas size, placement, trigger, frequency, and
 * popup-level style. The placement thumbnails double as live previews of
 * where the popup lands on a host page.
 */

const inputClass =
  'h-9 w-full rounded-md border border-[#dedbd5] bg-white px-2.5 text-sm text-[#141413] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15'

const PLACEMENTS: PopupPlacement[] = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'fullscreen']

const FREQUENCIES: PopupFrequency[] = ['every-visit', 'once-per-session', 'once-per-day', 'once-per-week']

export function PopupSettings({
  width,
  height,
  placement,
  trigger,
  frequency,
  schedule,
  style,
  onChange,
}: {
  width: number
  height: number
  placement: PopupPlacement
  trigger: PopupTriggerConfig
  frequency: PopupFrequency
  schedule: PopupSchedule
  style: PopupStyle
  onChange: (patch: {
    width?: number
    height?: number
    placement?: PopupPlacement
    trigger?: PopupTriggerConfig
    frequency?: PopupFrequency
    schedule?: PopupSchedule
    style?: PopupStyle
  }) => void
}) {
  const hasSchedule = Boolean(
    schedule.startAt || schedule.endAt || schedule.dailyStart || schedule.dailyEnd,
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8e8b82]">
        Popup settings
      </p>

      {/* Size */}
      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width (px)" value={width} min={POPUP_MIN_WIDTH} max={POPUP_MAX_WIDTH} onChange={(w) => onChange({ width: w })} />
          <NumberField label="Height (px)" value={height} min={POPUP_MIN_HEIGHT} max={POPUP_MAX_HEIGHT} onChange={(h) => onChange({ height: h })} />
        </div>
        <p className="text-[10px] leading-4 text-[#8e8b82]">
          Enter an exact size from 120 to 4,000 px. On narrower screens, the
          canvas scales down to remain visible.
        </p>
      </section>

      {/* Placement */}
      <section className="flex flex-col gap-1.5">
        <SettingLabel>Placement</SettingLabel>
        <div className="grid grid-cols-3 gap-2">
          {PLACEMENTS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ placement: option })}
              aria-pressed={placement === option}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                placement === option
                  ? 'border-[#cc785c] bg-[#fffaf7] text-[#a9583e]'
                  : 'border-[#dedbd5] bg-white text-[#6c6a64] hover:border-[#cfc6ba]'
              }`}
            >
              <PlacementThumb placement={option} active={placement === option} />
              <span className="text-[10px] font-medium capitalize">{option.replace('-', ' ')}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Trigger */}
      <section className="flex flex-col gap-2">
        <SettingLabel>When it appears</SettingLabel>
        <div className="flex flex-col gap-1.5">
          <TriggerCard
            active={trigger.type === 'on-load'}
            title="On page load"
            detail="Shows after the page loads."
            onClick={() => onChange({ trigger: { type: 'on-load', delayMs: 0 } })}
          />
          {trigger.type === 'on-load' ? (
            <NumberField label="Delay (ms)" value={trigger.delayMs} min={0} max={600000} step={250} onChange={(delayMs) => onChange({ trigger: { type: 'on-load', delayMs } })} />
          ) : null}
          <TriggerCard
            active={trigger.type === 'exit-intent'}
            title="Exit intent"
            detail="Shows when the visitor moves toward the tab's top edge."
            onClick={() => onChange({ trigger: { type: 'exit-intent' } })}
          />
          <TriggerCard
            active={trigger.type === 'scroll-depth'}
            title="Scroll depth"
            detail="Shows after the visitor scrolls far enough."
            onClick={() => onChange({ trigger: { type: 'scroll-depth', percent: 50 } })}
          />
          {trigger.type === 'scroll-depth' ? (
            <NumberField label="Percent scrolled (%)" value={trigger.percent} min={1} max={100} onChange={(percent) => onChange({ trigger: { type: 'scroll-depth', percent } })} />
          ) : null}
          <TriggerCard
            active={trigger.type === 'click-element'}
            title="Click on element"
            detail="Shows when a CSS selector on the host page is clicked."
            onClick={() => onChange({ trigger: { type: 'click-element', selector: '#open-offer' } })}
          />
          {trigger.type === 'click-element' ? (
            <input
              className={inputClass}
              value={trigger.selector}
              placeholder="CSS selector, e.g. #open-offer"
              onChange={(event) => onChange({ trigger: { type: 'click-element', selector: event.target.value } })}
            />
          ) : null}
        </div>
      </section>

      {/* Frequency */}
      <section className="flex flex-col gap-1.5">
        <SettingLabel>How often</SettingLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {FREQUENCIES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={frequency === option}
              onClick={() => onChange({ frequency: option })}
              className={`h-9 rounded-md border px-2 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                frequency === option
                  ? 'border-[#cc785c] bg-[#fffaf7] text-[#a9583e]'
                  : 'border-[#dedbd5] bg-white text-[#6c6a64] hover:border-[#cfc6ba]'
              }`}
            >
              {option.replace('once-per-', '1× / ').replace('every-visit', 'Every visit').replace('1× / session', 'Once per session').replace('1× / day', 'Once per day').replace('1× / week', 'Once per week')}
            </button>
          ))}
        </div>
      </section>

      {/* Schedule */}
      <section className="flex flex-col gap-2 border-t border-[#efe9de] pt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SettingLabel>Display schedule</SettingLabel>
            <p className="mt-0.5 text-[10px] leading-4 text-[#8e8b82]">Leave blank to keep the popup always active.</p>
          </div>
          {hasSchedule ? (
            <button type="button" onClick={() => onChange({ schedule: {} })} className="text-[10px] font-semibold text-[#a9583e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]">
              Clear
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <DateTimeField
            label="Starts"
            value={isoToLocalValue(schedule.startAt)}
            max={isoToLocalValue(schedule.endAt)}
            onChange={(value) => onChange({ schedule: { ...schedule, startAt: localValueToIso(value) } })}
          />
          <DateTimeField
            label="Ends"
            value={isoToLocalValue(schedule.endAt)}
            min={isoToLocalValue(schedule.startAt)}
            onChange={(value) => onChange({ schedule: { ...schedule, endAt: localValueToIso(value) } })}
          />
        </div>

        <div className="rounded-lg border border-[#e6dfd8] bg-[#f7f3ed] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#3d3d3a]">Daily hours</p>
              <p className="mt-0.5 text-[10px] leading-4 text-[#817d76]">Uses each visitor’s local time.</p>
            </div>
            {schedule.dailyStart || schedule.dailyEnd ? (
              <button type="button" onClick={() => onChange({ schedule: { ...schedule, dailyStart: undefined, dailyEnd: undefined } })} className="text-[10px] font-semibold text-[#a9583e] hover:underline">
                Remove
              </button>
            ) : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <TimeField
              label="From"
              value={schedule.dailyStart ?? ''}
              onChange={(dailyStart) => onChange({ schedule: { ...schedule, dailyStart: dailyStart || undefined, dailyEnd: schedule.dailyEnd ?? (dailyStart ? '17:00' : undefined) } })}
            />
            <TimeField
              label="Until"
              value={schedule.dailyEnd ?? ''}
              onChange={(dailyEnd) => onChange({ schedule: { ...schedule, dailyStart: schedule.dailyStart ?? (dailyEnd ? '09:00' : undefined), dailyEnd: dailyEnd || undefined } })}
            />
          </div>
          {schedule.dailyStart && schedule.dailyEnd ? (
            <p className="mt-2 text-[10px] font-medium text-[#6c6a64]">
              Active daily from {formatTime(schedule.dailyStart)} to {formatTime(schedule.dailyEnd)}.
            </p>
          ) : null}
        </div>
      </section>

      {/* Style */}
      <section className="flex flex-col gap-2 border-t border-[#efe9de] pt-3">
        <SettingLabel>Look &amp; feel</SettingLabel>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
            Font
            <select
              className={inputClass}
              value={style.fontFamily ?? 'sans'}
              onChange={(event) => onChange({ style: { ...style, fontFamily: event.target.value as PopupStyle['fontFamily'] } })}
            >
              <option value="sans">Sans (Inter)</option>
              <option value="serif">Serif (Cormorant)</option>
              <option value="mono">Mono (JetBrains)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
            Animation
            <select
              className={inputClass}
              value={style.animation ?? 'fade'}
              onChange={(event) => onChange({ style: { ...style, animation: event.target.value as PopupStyle['animation'] } })}
            >
              <option value="fade">Fade</option>
              <option value="zoom">Zoom</option>
              <option value="slide-up">Slide up</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
        <div className="rounded-xl border border-[#e6dfd8] bg-[#f7f3ed] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#3d3d3a]">Canvas background</p>
              <p className="mt-0.5 text-[10px] leading-4 text-[#817d76]">
                Add artwork behind every element. A subtle tint can keep text readable.
              </p>
            </div>
            {style.backgroundImage ? (
              <button
                type="button"
                onClick={() => onChange({ style: { ...style, backgroundImage: '' } })}
                className="shrink-0 text-[10px] font-semibold text-[#a9583e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
              >
                Remove
              </button>
            ) : null}
          </div>
          <label className="mt-2 flex flex-col gap-1 text-[10px] font-medium text-[#55514b]">
            Image URL
            <input
              className={inputClass}
              type="url"
              value={style.backgroundImage ?? ''}
              placeholder="https://example.com/campaign.jpg"
              onChange={(event) => onChange({ style: { ...style, backgroundImage: event.target.value } })}
            />
          </label>
          {style.backgroundImage ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-medium text-[#55514b]">
                  Fit
                  <select
                    className={inputClass}
                    value={style.backgroundImageSize ?? 'cover'}
                    onChange={(event) => onChange({ style: { ...style, backgroundImageSize: event.target.value as PopupStyle['backgroundImageSize'] } })}
                  >
                    <option value="cover">Fill canvas</option>
                    <option value="contain">Show whole image</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-medium text-[#55514b]">
                  Focus
                  <select
                    className={inputClass}
                    value={style.backgroundImagePosition ?? 'center'}
                    onChange={(event) => onChange({ style: { ...style, backgroundImagePosition: event.target.value as PopupStyle['backgroundImagePosition'] } })}
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
              <div className="mt-2 grid grid-cols-[64px_1fr] items-end gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-medium text-[#55514b]">
                  Tint
                  <input
                    type="color"
                    className="h-9 w-full cursor-pointer rounded-md border border-[#dedbd5] bg-white px-1"
                    value={style.backgroundImageOverlayColor ?? '#141413'}
                    onChange={(event) => onChange({ style: { ...style, backgroundImageOverlayColor: event.target.value } })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-medium text-[#55514b]">
                  Tint strength ({Math.round((style.backgroundImageOverlayOpacity ?? 0) * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={style.backgroundImageOverlayOpacity ?? 0}
                    onChange={(event) => onChange({ style: { ...style, backgroundImageOverlayOpacity: Number(event.target.value) } })}
                    className="h-9 w-full accent-[#cc785c]"
                  />
                </label>
              </div>
            </>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
            Card
            <input
              type="color"
              className="h-9 w-full cursor-pointer rounded-md border border-[#dedbd5] bg-white px-1"
              value={style.backgroundColor ?? '#ffffff'}
              onChange={(event) => onChange({ style: { ...style, backgroundColor: event.target.value } })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
            Overlay
            <input
              type="color"
              className="h-9 w-full cursor-pointer rounded-md border border-[#dedbd5] bg-white px-1"
              value={style.overlayColor ?? '#141413'}
              onChange={(event) => onChange({ style: { ...style, overlayColor: event.target.value } })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
            Radius
            <CommittedNumberInput
              min={0}
              max={64}
              value={style.borderRadius ?? 16}
              onCommit={(borderRadius) => onChange({ style: { ...style, borderRadius } })}
              className="h-9 w-full rounded-md border border-[#dedbd5] bg-white px-2 text-sm text-[#141413] outline-none focus:border-[#cc785c]"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
          Overlay opacity ({Math.round((style.overlayOpacity ?? 0.5) * 100)}%)
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.05}
            value={style.overlayOpacity ?? 0.5}
            onChange={(event) => onChange({ style: { ...style, overlayOpacity: Number(event.target.value) } })}
            className="w-full accent-[#cc785c]"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <CheckRow
            label="Show the ✕ close button"
            checked={style.closable !== false}
            onChange={(closable) => onChange({ style: { ...style, closable } })}
          />
          <CheckRow
            label="Close when the overlay is clicked"
            checked={style.closeOnOverlayClick !== false}
            onChange={(closeOnOverlayClick) => onChange({ style: { ...style, closeOnOverlayClick } })}
          />
        </div>
      </section>
    </div>
  )
}

// ── Primitives ──

function SettingLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-[#141413]">{children}</p>
}

function isoToLocalValue(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function localValueToIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function formatTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2000, 0, 1, hours, minutes))
}

function DateTimeField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
      {label}
      <input type="datetime-local" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className={`${inputClass} px-2 text-xs`} />
    </label>
  )
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-medium text-[#55514b]">
      {label}
      <input type="time" value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} px-2 text-xs`} />
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
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-[#3d3d3a]">
      {label}
      <CommittedNumberInput
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onCommit={onChange}
        className={inputClass}
      />
    </label>
  )
}

function TriggerCard({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
        active ? 'border-[#cc785c] bg-[#fffaf7]' : 'border-[#dedbd5] bg-white hover:border-[#cfc6ba]'
      }`}
    >
      <span className={`block text-xs font-semibold ${active ? 'text-[#a9583e]' : 'text-[#141413]'}`}>{title}</span>
      <span className="mt-0.5 block text-[10px] leading-4 text-[#8e8b82]">{detail}</span>
    </button>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-[#3d3d3a]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#cc785c]"
      />
      {label}
    </label>
  )
}

function PlacementThumb({ placement, active }: { placement: PopupPlacement; active: boolean }) {
  const dot = 'absolute rounded-[1px]'
  const dotColor = active ? 'bg-[#cc785c]' : 'bg-[#cfc6ba]'
  const positions: Record<PopupPlacement, React.ReactNode> = {
    center: <span className={`${dot} ${dotColor} left-1/2 top-1/2 h-1.5 w-3 -translate-x-1/2 -translate-y-1/2`} />,
    'top-left': <span className={`${dot} ${dotColor} left-0.5 top-0.5 h-1.5 w-3`} />,
    'top-right': <span className={`${dot} ${dotColor} right-0.5 top-0.5 h-1.5 w-3`} />,
    'bottom-left': <span className={`${dot} ${dotColor} bottom-0.5 left-0.5 h-1.5 w-3`} />,
    'bottom-right': <span className={`${dot} ${dotColor} bottom-0.5 right-0.5 h-1.5 w-3`} />,
    fullscreen: <span className={`absolute inset-0.5 rounded-[1px] ${active ? 'bg-[#cc785c]/40' : 'bg-[#cfc6ba]/40'}`} />,
  }
  return (
    <span className="relative block h-7 w-full rounded border border-[#e6dfd8] bg-[#faf9f5]">
      {positions[placement]}
    </span>
  )
}
