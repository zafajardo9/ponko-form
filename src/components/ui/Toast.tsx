import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'

interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
}

interface ToastApi {
  show: (input: ToastInput) => number
  success: (title: string, description?: string) => number
  error: (title: string, description?: string) => number
  info: (title: string, description?: string) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const show = useCallback((input: ToastInput) => {
    const id = ++nextId.current
    setItems((current) => [...current.slice(-3), { tone: 'info', duration: 4200, ...input, id }])
    return id
  }, [])

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (title, description) => show({ title, description, tone: 'success' }),
    error: (title, description) => show({ title, description, tone: 'error', duration: 6500 }),
    info: (title, description) => show({ title, description, tone: 'info' }),
    dismiss,
  }), [dismiss, show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[380px]"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = item.tone ?? 'info'
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border bg-white shadow-[0_16px_45px_rgba(37,32,27,0.16)] motion-safe:animate-[toast-in_180ms_ease-out] ${
        tone === 'success'
          ? 'border-[#c9ddcc]'
          : tone === 'error'
            ? 'border-[#e5c4bd]'
            : 'border-[#ddd5cb]'
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${
          tone === 'success' ? 'bg-[#4f8758]' : tone === 'error' ? 'bg-[#b74e3c]' : 'bg-[#cc785c]'
        }`}
      />
      <div className="flex items-start gap-3 py-3.5 pl-4 pr-3">
        <Icon
          size={18}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 ${
            tone === 'success' ? 'text-[#3f7048]' : tone === 'error' ? 'text-[#a33f32]' : 'text-[#a9583e]'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#141413]">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 text-xs leading-5 text-[#6c6a64]">{item.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8e8b82] transition-colors hover:bg-[#f5f0e8] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <ToastTimer duration={item.duration ?? 4200} onDone={onDismiss} tone={tone} />
    </div>
  )
}

function ToastTimer({
  duration,
  onDone,
  tone,
}: {
  duration: number
  onDone: () => void
  tone: ToastTone
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, duration)
    return () => window.clearTimeout(timer)
  }, [duration, onDone])

  return (
    <span
      aria-hidden="true"
      style={{ animationDuration: `${duration}ms` }}
      className={`block h-0.5 origin-left motion-safe:animate-[toast-timer_linear_forwards] ${
        tone === 'success' ? 'bg-[#8eb596]' : tone === 'error' ? 'bg-[#d38b7e]' : 'bg-[#dfa38d]'
      }`}
    />
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used within ToastProvider')
  return value
}
