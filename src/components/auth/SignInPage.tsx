import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { authClient } from '../../lib/auth-client'

type AuthMode = 'sign-in' | 'sign-up'
type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword', string>>

const STATS: { value: string; label: string }[] = [
  { value: '20+', label: 'Field types' },
  { value: '15+', label: 'Flow nodes' },
  { value: '2', label: 'Payment gateways' },
  { value: '0', label: 'Code required' },
]

export function SignInPage({ returnTo, configured }: { returnTo: string; configured: boolean }) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const creatingAccount = mode === 'sign-up'

  function changeMode(nextMode: AuthMode) {
    if (loading || nextMode === mode) return
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
    setErrors({})
    setError(null)
    setShowPassword(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateFields({ mode, name, email, password, confirmPassword })
    setErrors(nextErrors)
    setError(null)
    if (Object.keys(nextErrors).length > 0) return
    if (!configured) {
      setError('Account access is not configured for this deployment yet.')
      return
    }

    setLoading(true)
    const normalizedEmail = email.trim().toLowerCase()
    try {
      const result = creatingAccount
        ? await authClient.signUp.email({
            name: name.trim(),
            email: normalizedEmail,
            password,
            callbackURL: returnTo,
          })
        : await authClient.signIn.email({
            email: normalizedEmail,
            password,
            rememberMe,
            callbackURL: returnTo,
          })

      if (result.error) {
        setError(authErrorMessage(result.error, creatingAccount))
        setLoading(false)
        return
      }
      window.location.assign(returnTo)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f1e9] p-3 sm:p-5">
      <div className="grid min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[24px] bg-[#faf9f5] shadow-[0_28px_80px_rgba(45,37,30,0.08)] sm:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden overflow-hidden bg-[#faf9f5] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-[-12%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(204,120,92,0.5),transparent_65%)] blur-2xl" />
          <div className="absolute left-[-18%] top-1/3 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle_at_center,rgba(240,183,160,0.45),transparent_65%)] blur-2xl" />
          <div className="absolute bottom-[-22%] right-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(169,88,62,0.32),transparent_65%)] blur-3xl" />
        </div>

        <a href="/" className="relative flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#cc785c] text-sm font-bold text-white">P</span>
          <span className="text-lg font-semibold tracking-tight text-[#141413]">PonkoForm</span>
        </a>

        <div className="relative">
          <h2 className="max-w-md font-[var(--font-display)] text-5xl font-normal leading-[1.06] tracking-[-0.02em] text-[#141413] xl:text-6xl">
            <span className="bg-gradient-to-r from-[#cc785c] to-[#8a4a33] bg-clip-text text-transparent">Build forms</span>
            <br />
            that collect more.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-6 text-[#6c6a64]">
            One builder for forms, flows, and payments — drag, drop, and ship.
          </p>

          <div className="mt-12 grid grid-cols-4 gap-6 border-t border-[#e6dfd8] pt-8">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-xl font-semibold tracking-tight text-[#141413]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#6c6a64]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-10 sm:py-12">
        <div className="w-full max-w-[400px]">
          <a href="/" className="mb-10 flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#cc785c] text-sm font-bold text-white">P</span>
            <span className="text-lg font-semibold tracking-tight text-[#141413]">PonkoForm</span>
          </a>

          <h1 className="text-3xl font-semibold tracking-tight text-[#141413] sm:text-4xl">
            {creatingAccount ? 'Sign up' : 'Sign in'}
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-[#6c6a64]">
            {creatingAccount
              ? 'Almost there — create your PonkoForm account to start building.'
              : 'Welcome back. Sign in to continue to your workspace.'}
          </p>

          <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
            {creatingAccount ? (
              <AuthField
                id="auth-name"
                label="Name"
                value={name}
                onChange={setName}
                autoComplete="name"
                placeholder="Your name"
                error={errors.name}
              />
            ) : null}

            <AuthField
              id="auth-email"
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              error={errors.email}
            />

            <PasswordField
              id="auth-password"
              label="Password"
              value={password}
              onChange={setPassword}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              autoComplete={creatingAccount ? 'new-password' : 'current-password'}
              helper={creatingAccount ? 'Use at least 8 characters.' : undefined}
              error={errors.password}
            />

            {creatingAccount ? (
              <PasswordField
                id="auth-confirm-password"
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                autoComplete="new-password"
                error={errors.confirmPassword}
              />
            ) : (
              <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-[#57544d]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-[#cfc5b8] accent-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
                />
                Keep me signed in
              </label>
            )}

            {error ? (
              <p role="alert" className="rounded-lg border border-[#efd0ca] bg-[#fff5f3] px-4 py-3 text-sm leading-5 text-[#9d382e]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#a9583e] px-5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#914630] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? (creatingAccount ? 'Creating your account…' : 'Signing you in…') : (creatingAccount ? 'Create account' : 'Continue')}
              {!loading ? <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#77736c]">
            {creatingAccount ? 'Already have an account?' : 'New to PonkoForm?'}{' '}
            <button
              type="button"
              onClick={() => changeMode(creatingAccount ? 'sign-in' : 'sign-up')}
              className="font-semibold text-[#a9583e] underline decoration-[#d9aa98] underline-offset-4 hover:text-[#914630] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
            >
              {creatingAccount ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </section>
      </div>
    </main>
  )
}

function AuthField({ id, label, value, onChange, error, type = 'text', ...inputProps }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  autoComplete?: string
  inputMode?: 'email' | 'text'
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#282622]">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 h-12 w-full rounded-lg border bg-white px-4 text-sm text-[#282622] outline-none transition-[border-color,box-shadow] placeholder:text-[#aaa39a] focus:ring-2 ${error ? 'border-[#d8877c] focus:border-[#bd5749] focus:ring-[#bd5749]/15' : 'border-[#dcd4ca] focus:border-[#cc785c] focus:ring-[#cc785c]/15'}`}
        {...inputProps}
      />
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs text-[#ad4338]">{error}</p> : null}
    </div>
  )
}

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete, error, helper }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  onToggle: () => void
  autoComplete: string
  error?: string
  helper?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#282622]">{label}</label>
      <div className="relative mt-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          className={`h-12 w-full rounded-lg border bg-white px-4 pr-12 text-sm text-[#282622] outline-none transition-[border-color,box-shadow] placeholder:text-[#aaa39a] focus:ring-2 ${error ? 'border-[#d8877c] focus:border-[#bd5749] focus:ring-[#bd5749]/15' : 'border-[#dcd4ca] focus:border-[#cc785c] focus:ring-[#cc785c]/15'}`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[#77736c] hover:text-[#282622] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c]"
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs text-[#ad4338]">{error}</p> : helper ? <p id={`${id}-helper`} className="mt-1.5 text-xs text-[#8a847c]">{helper}</p> : null}
    </div>
  )
}

function validateFields(input: { mode: AuthMode; name: string; email: string; password: string; confirmPassword: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (input.mode === 'sign-up' && input.name.trim().length < 2) errors.name = 'Enter your name.'
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) errors.email = 'Enter a valid email address.'
  if (input.password.length < 8) errors.password = 'Password must be at least 8 characters.'
  if (input.password.length > 128) errors.password = 'Password must be 128 characters or fewer.'
  if (input.mode === 'sign-up' && input.confirmPassword !== input.password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

function authErrorMessage(error: { code?: string; message?: string }, creatingAccount: boolean) {
  if (error.code === 'USER_ALREADY_EXISTS' || error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (error.code === 'INVALID_EMAIL_OR_PASSWORD') return 'The email or password is incorrect.'
  if (error.code === 'TOO_MANY_REQUESTS') return 'Too many attempts. Wait a moment and try again.'
  return error.message || (creatingAccount ? 'Unable to create your account.' : 'Unable to sign you in.')
}
