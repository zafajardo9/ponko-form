import { useState, type ButtonHTMLAttributes, type CSSProperties } from 'react'

type SwitchSize = 'sm' | 'md'
type SwitchVariant = 'default' | 'inverse'
type StateLabelMode = 'always' | 'responsive' | 'hidden'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  checkedLabel?: string
  uncheckedLabel?: string
  size?: SwitchSize
  variant?: SwitchVariant
  stateLabel?: StateLabelMode
}

const sizeClasses: Record<SwitchSize, { button: string; track: string; thumb: string; travel: string }> = {
  sm: {
    button: 'min-h-8 gap-2 px-2 text-xs',
    track: 'h-5 w-9 p-0.5',
    thumb: 'h-4 w-4',
    travel: '16px',
  },
  md: {
    button: 'min-h-10 gap-2.5 px-2.5 text-sm',
    track: 'h-6 w-11 p-0.5',
    thumb: 'h-5 w-5',
    travel: '20px',
  },
}

const variantClasses: Record<SwitchVariant, { button: string; offTrack: string; focus: string }> = {
  default: {
    button: 'text-[#35322e] hover:bg-[#f5f0e8]',
    offTrack: 'border-[#cfc7bd] bg-[#ded8d0]',
    focus: 'focus-visible:ring-[#cc785c]/35',
  },
  inverse: {
    button: 'text-white hover:bg-white/10',
    offTrack: 'border-white/15 bg-white/20',
    focus: 'focus-visible:ring-[#e7a58f]',
  },
}

export function Switch({
  checked,
  onCheckedChange,
  checkedLabel = 'On',
  uncheckedLabel = 'Off',
  size = 'sm',
  variant = 'default',
  stateLabel = 'always',
  className = '',
  disabled,
  'aria-label': ariaLabel,
  ...props
}: SwitchProps) {
  const [initialized, setInitialized] = useState(false)
  const sizes = sizeClasses[size]
  const colors = variantClasses[variant]
  const stateText = checked ? checkedLabel : uncheckedLabel
  const labelVisibility = stateLabel === 'hidden' ? 'sr-only' : stateLabel === 'responsive' ? 'hidden sm:inline' : ''

  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? stateText}
      disabled={disabled}
      onClick={() => {
        setInitialized(true)
        onCheckedChange(!checked)
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizes.button} ${colors.button} ${colors.focus} ${className}`}
    >
      <span className={labelVisibility}>{stateText}</span>
      <span
        aria-hidden="true"
        data-on={checked}
        style={{ '--toggle-travel': sizes.travel } as CSSProperties}
        className={`t-toggle box-border inline-flex shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none ${initialized ? 'is-init' : ''} ${sizes.track} ${checked ? 'border-[#cc785c] bg-[#cc785c]' : colors.offTrack}`}
      >
        <span className={`t-toggle-thumb block shrink-0 rounded-full bg-white shadow-[0_1px_2px_rgba(20,20,19,0.28)] ${sizes.thumb}`} />
      </span>
    </button>
  )
}
