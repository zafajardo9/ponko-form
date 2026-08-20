import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getStrValue, getOptions, formatMoney } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
  hideLabel?: boolean
}

interface SelectItem {
  value: string
  label: string
  price?: number | null
}

export function SelectField({ field, value, onChange, error, readOnly, hideLabel }: Props) {
  const strValue = getStrValue(value)
  const options = getOptions(field)
  const inputId = `field-input-${field.id}`
  const labelId = `field-label-${field.id}`
  const errorId = `field-error-${field.id}`
  const listboxId = `field-listbox-${field.id}`

  const items: SelectItem[] = [
    ...(!field.required ? [{ value: '', label: field.placeholder || 'Select…' }] : []),
    ...options.map((opt) => ({ value: opt.value, label: opt.label, price: opt.price })),
  ]

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLLIElement | null)[]>([])

  const selectedItem = items.find((item) => item.value === strValue)
  const displayLabel = selectedItem
    ? `${selectedItem.label}${selectedItem.price != null ? ` ${formatMoney(selectedItem.price, 'PHP')}` : ''}`
    : field.placeholder || 'Select…'

  // Close on outside pointer-down and Escape; scroll active option into view.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  function openMenu() {
    const current = items.findIndex((item) => item.value === strValue)
    setActiveIndex(current >= 0 ? current : 0)
    setOpen(true)
  }

  function select(item: SelectItem) {
    onChange(item.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (readOnly) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) openMenu()
        else setActiveIndex((index) => (index + 1) % items.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (!open) openMenu()
        else setActiveIndex((index) => (index - 1 + items.length) % items.length)
        break
      case 'Home':
        if (open) {
          event.preventDefault()
          setActiveIndex(0)
        }
        break
      case 'End':
        if (open) {
          event.preventDefault()
          setActiveIndex(items.length - 1)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!open) openMenu()
        else {
          const item = items[activeIndex]
          if (item) select(item)
        }
        break
      case 'Tab':
        if (open) setOpen(false)
        break
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {!hideLabel && (
        <label htmlFor={inputId} id={labelId} className="text-sm font-medium text-[var(--ponko-foreground,#141413)]">
          {field.label || 'Untitled field'}
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </label>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-[#c64545]">
          {error}
        </p>
      )}
      <div ref={containerRef} className="relative min-w-0">
        <button
          ref={buttonRef}
          type="button"
          id={inputId}
          disabled={readOnly}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onButtonKeyDown}
          className={`flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[var(--ponko-radius,6px)] border px-3.5 text-left text-sm outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? 'border-[#c64545] focus-visible:border-[#c64545] focus-visible:ring-[#c64545]/20'
              : open
                ? 'border-[var(--ponko-primary,#cc785c)] bg-white ring-2 ring-[var(--ponko-primary-soft,#cc785c29)]'
                : 'border-[#e6dfd8] bg-[#faf9f5] hover:border-[#cfc4b8] focus-visible:border-[var(--ponko-primary,#cc785c)] focus-visible:ring-[var(--ponko-primary-soft,#cc785c29)]'
          }`}
        >
          <span
            className={`min-w-0 truncate ${
              selectedItem ? 'text-[var(--ponko-foreground,#141413)]' : 'text-[var(--ponko-foreground-faint,#8e8b82)]'
            }`}
          >
            {displayLabel}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`shrink-0 text-[var(--ponko-foreground-faint,#8e8b82)] transition-transform duration-150 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && !readOnly && (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            className="absolute left-0 right-0 z-20 mt-1.5 max-h-64 overflow-auto rounded-[var(--ponko-radius,8px)] border border-[#e6dfd8] bg-white p-1 shadow-[0_12px_32px_rgba(54,45,36,0.16)]"
          >
            {items.map((item, index) => {
              const isSelected = item.value === strValue
              const isActive = index === activeIndex
              return (
                <li
                  key={item.value || '__empty__'}
                  ref={(el) => {
                    optionRefs.current[index] = el
                  }}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(item)}
                  className={`flex cursor-pointer items-center gap-2 rounded-[var(--ponko-radius,6px)] px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-[var(--ponko-primary-soft,#cc785c29)]' : ''
                  } ${isSelected ? 'font-medium text-[var(--ponko-foreground,#141413)]' : 'text-[var(--ponko-foreground,#141413)]'}`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.price != null && (
                    <span className="shrink-0 text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">
                      {formatMoney(item.price, 'PHP')}
                    </span>
                  )}
                  {isSelected && (
                    <Check size={15} aria-hidden="true" className="shrink-0 text-[var(--ponko-primary,#cc785c)]" />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
