import { useEffect, useRef, useState } from 'react'

interface RecaptchaApi {
  render: (container: HTMLElement, options: {
    sitekey: string
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => void
    theme: 'light'
  }) => number
  reset: (widgetId?: number) => void
}

declare global {
  interface Window {
    grecaptcha?: RecaptchaApi
    __ponkoRecaptchaLoaded?: () => void
  }
}

let loader: Promise<RecaptchaApi> | null = null

function loadRecaptcha(): Promise<RecaptchaApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('reCAPTCHA requires a browser'))
  if (window.grecaptcha) return Promise.resolve(window.grecaptcha)
  if (loader) return loader

  loader = new Promise<RecaptchaApi>((resolve, reject) => {
    window.__ponkoRecaptchaLoaded = () => {
      if (window.grecaptcha) resolve(window.grecaptcha)
      else reject(new Error('Google reCAPTCHA did not initialize'))
    }
    const existing = document.getElementById('ponko-recaptcha-script') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('error', () => reject(new Error('Google reCAPTCHA failed to load')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = 'ponko-recaptcha-script'
    script.src = 'https://www.google.com/recaptcha/api.js?onload=__ponkoRecaptchaLoaded&render=explicit'
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('Google reCAPTCHA failed to load'))
    document.head.appendChild(script)
  })
  return loader
}

interface RecaptchaFieldProps {
  label: string
  required?: boolean
  siteKey?: string | null
  error?: string
  preview?: boolean
  onChange: (token: string) => void
}

export function RecaptchaField({ label, required, siteKey, error, preview, onChange }: RecaptchaFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  const [loadError, setLoadError] = useState('')
  onChangeRef.current = onChange

  useEffect(() => {
    if (preview || !siteKey || !containerRef.current) return
    let cancelled = false
    void loadRecaptcha()
      .then((api) => {
        if (cancelled || !containerRef.current) return
        containerRef.current.replaceChildren()
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => {
            setLoadError('')
            onChangeRef.current(token)
          },
          'expired-callback': () => onChangeRef.current(''),
          'error-callback': () => {
            onChangeRef.current('')
            setLoadError('Google reCAPTCHA encountered a network error. Please retry.')
          },
        })
      })
      .catch((recaptchaError: unknown) => {
        loader = null
        console.error('[ponkoform-recaptcha] Google reCAPTCHA failed to load', recaptchaError)
        if (!cancelled) {
          setLoadError('Google reCAPTCHA could not load. Check your connection and retry.')
        }
      })
    return () => {
      cancelled = true
      if (widgetIdRef.current != null && window.grecaptcha) window.grecaptcha.reset(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [preview, siteKey])

  const configurationError = !preview && !siteKey
    ? 'reCAPTCHA is not configured for this form. Please contact the form owner.'
    : ''

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {label.trim() && (
        <p className="break-words text-sm font-medium text-[#141413]">
          {label}
          {required && <span className="ml-0.5 text-[#c64545]">*</span>}
        </p>
      )}
      {preview ? (
        <div className="flex h-[78px] w-[304px] max-w-full items-center gap-3 rounded border border-[#d8d8d8] bg-[#fafafa] px-4 text-sm text-[#3d3d3a]">
          <span className="h-7 w-7 rounded border-2 border-[#777] bg-white" />
          <span>I’m not a robot</span>
          <span className="ml-auto text-xs text-[#777]">reCAPTCHA</span>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-[78px] max-w-full overflow-x-auto" />
      )}
      {(error || loadError || configurationError) && (
        <p className="text-xs text-[#c64545]" role="alert">{error || loadError || configurationError}</p>
      )}
    </div>
  )
}
