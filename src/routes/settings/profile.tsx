import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { authClient } from '../../lib/auth-client'
import { requireAuth } from '../../lib/server-fns/auth'
import { getMyProfile, updateMyProfile } from '../../lib/server-fns/profile'

export const Route = createFileRoute('/settings/profile')({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: ProfilePage,
})

function ProfilePage() {
  const profileQuery = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => getMyProfile(),
  })

  return (
    <main className="min-h-screen bg-[#f7f5f1]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="border-b border-[#dcd8d1] pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8b82]">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#141413] sm:text-4xl">Profile & security</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#6c6a64]">
            Update how people see you in PonkoForm and keep your account access secure.
          </p>
        </header>

        <div className="mt-8 sm:mt-10">
          {profileQuery.isPending ? <ProfileLoading /> : null}
          {profileQuery.isError ? (
            <div className="rounded-xl border border-[#e7cbc5] bg-[#fff7f5] p-5 text-sm text-[#9d382e]">
              <p>We couldn’t load your profile.</p>
              <Button type="button" variant="secondary" className="mt-4" onClick={() => void profileQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : null}
          {profileQuery.data ? (
            <div className="space-y-6">
              <ProfileForm initialProfile={profileQuery.data} />
              <PasswordForm />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

type PasswordErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visibleField, setVisibleField] = useState<string | null>(null)
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validatePasswordChange({ currentPassword, newPassword, confirmPassword })
    setErrors(nextErrors)
    setError(null)
    setSaved(false)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })

      if (result.error) {
        setError(passwordErrorMessage(result.error))
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setVisibleField(null)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your password could not be changed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-[#ded8cf] bg-white shadow-[0_14px_40px_rgba(20,20,19,0.05)]">
      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eee3d9] text-[#9c503a] ring-1 ring-inset ring-[#dfd1c5]">
            <LockKeyhole size={20} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[#282622]">Change password</h2>
          <p className="mt-2 max-w-[15rem] text-xs leading-5 text-[#817d76]">
            Use at least 8 characters. Other signed-in devices will be logged out after the change.
          </p>
        </div>

        <div className="space-y-5">
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            visible={visibleField === 'current-password'}
            onToggle={() => setVisibleField((field) => field === 'current-password' ? null : 'current-password')}
            autoComplete="current-password"
            error={errors.currentPassword}
          />
          <PasswordField
            id="new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            visible={visibleField === 'new-password'}
            onToggle={() => setVisibleField((field) => field === 'new-password' ? null : 'new-password')}
            autoComplete="new-password"
            error={errors.newPassword}
          />
          <PasswordField
            id="confirm-new-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={visibleField === 'confirm-new-password'}
            onToggle={() => setVisibleField((field) => field === 'confirm-new-password' ? null : 'confirm-new-password')}
            autoComplete="new-password"
            error={errors.confirmPassword}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#e8e2da] bg-[#fcfbf8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div aria-live="polite" className="min-h-5 text-sm">
          {saved ? (
            <span className="inline-flex items-center gap-2 text-[#397052]">
              <ShieldCheck size={15} aria-hidden="true" /> Password changed. Other sessions were signed out.
            </span>
          ) : null}
          {error ? <span role="alert" className="text-[#a63f35]">{error}</span> : null}
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Updating…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}

function ProfileForm({ initialProfile }: {
  initialProfile: { name: string; email: string; avatarUrl: string }
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(initialProfile.name)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl)
  const [imageFailed, setImageFailed] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => setImageFailed(false), [avatarUrl])

  const mutation = useMutation({
    mutationFn: () => updateMyProfile({ data: { name, avatarUrl } }),
    onSuccess: (profile) => {
      queryClient.setQueryData(['my-profile'], profile)
      setName(profile.name)
      setAvatarUrl(profile.avatarUrl)
      setSaved(true)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    mutation.mutate()
  }

  const initial = (name.trim() || initialProfile.email || 'A').slice(0, 1).toUpperCase()

  return (
    <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-[#ded8cf] bg-white shadow-[0_14px_40px_rgba(20,20,19,0.05)]">
      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className="text-sm font-semibold text-[#282622]">Profile image</p>
          <div className="mt-4 flex items-center gap-4 lg:block">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eee3d9] text-3xl font-semibold text-[#9c503a] ring-1 ring-inset ring-[#dfd1c5] lg:h-32 lg:w-32">
              {avatarUrl && !imageFailed ? (
                <img src={avatarUrl} alt="Profile preview" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
              ) : (
                initial
              )}
            </div>
            <p className="max-w-[15rem] text-xs leading-5 text-[#817d76] lg:mt-4">
              Use a square image hosted at a secure HTTPS address. Your initial is shown when no image is provided.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <ProfileField
            id="profile-name"
            label="Display name"
            value={name}
            onChange={setName}
            autoComplete="name"
            maxLength={100}
            required
          />
          <ProfileField
            id="profile-avatar"
            label="Profile image URL"
            value={avatarUrl}
            onChange={setAvatarUrl}
            type="url"
            inputMode="url"
            placeholder="https://example.com/profile.jpg"
          />
          <div>
            <label htmlFor="profile-email" className="text-sm font-medium text-[#282622]">Email address</label>
            <input
              id="profile-email"
              value={initialProfile.email}
              readOnly
              className="mt-2 h-11 w-full cursor-not-allowed rounded-lg border border-[#e2ddd6] bg-[#f7f5f1] px-3.5 text-sm text-[#77736c] outline-none"
            />
            <p className="mt-1.5 text-xs text-[#8e8b82]">Your sign-in email cannot be changed here.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#e8e2da] bg-[#fcfbf8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div aria-live="polite" className="min-h-5 text-sm">
          {saved ? <span className="inline-flex items-center gap-2 text-[#397052]"><Check size={15} /> Profile updated.</span> : null}
          {mutation.isError ? <span className="text-[#a63f35]">{mutation.error instanceof Error ? mutation.error.message : 'Profile could not be updated.'}</span> : null}
        </div>
        <Button type="submit" disabled={mutation.isPending || name.trim().length < 2}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

function ProfileField({ id, label, value, onChange, ...props }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'url'
  placeholder?: string
  autoComplete?: string
  maxLength?: number
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#282622]">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-[#dcd4ca] bg-white px-3.5 text-sm text-[#282622] outline-none transition-[border-color,box-shadow] placeholder:text-[#aaa39a] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
        {...props}
      />
    </div>
  )
}

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete, error }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  onToggle: () => void
  autoComplete: string
  error?: string
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
          minLength={8}
          maxLength={128}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-11 w-full rounded-lg border bg-white px-3.5 pr-11 text-sm text-[#282622] outline-none transition-[border-color,box-shadow] focus:ring-2 ${
            error
              ? 'border-[#d8877c] focus:border-[#bd5749] focus:ring-[#bd5749]/15'
              : 'border-[#dcd4ca] focus:border-[#cc785c] focus:ring-[#cc785c]/15'
          }`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[#77736c] transition-colors hover:text-[#282622] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c]"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs text-[#ad4338]">{error}</p> : null}
    </div>
  )
}

function validatePasswordChange(input: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): PasswordErrors {
  const errors: PasswordErrors = {}
  if (!input.currentPassword) errors.currentPassword = 'Enter your current password.'
  if (input.newPassword.length < 8) errors.newPassword = 'New password must be at least 8 characters.'
  if (input.newPassword.length > 128) errors.newPassword = 'New password must be 128 characters or fewer.'
  if (input.newPassword && input.currentPassword === input.newPassword) {
    errors.newPassword = 'Choose a password different from your current password.'
  }
  if (input.confirmPassword !== input.newPassword) errors.confirmPassword = 'New passwords do not match.'
  return errors
}

function passwordErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === 'INVALID_PASSWORD' || error.code === 'INVALID_EMAIL_OR_PASSWORD') {
    return 'Your current password is incorrect.'
  }
  if (error.code === 'TOO_MANY_REQUESTS') return 'Too many attempts. Wait a moment and try again.'
  return error.message || 'Your password could not be changed. Please try again.'
}

function ProfileLoading() {
  return (
    <div aria-label="Loading profile" className="grid animate-pulse gap-8 rounded-2xl border border-[#ded8cf] bg-white p-5 sm:p-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="h-32 w-32 rounded-2xl bg-[#eee9e2]" />
      <div className="space-y-5">
        <div className="h-16 rounded-lg bg-[#f0ece6]" />
        <div className="h-16 rounded-lg bg-[#f0ece6]" />
        <div className="h-16 rounded-lg bg-[#f0ece6]" />
      </div>
    </div>
  )
}
