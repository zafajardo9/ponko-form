import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#141413] sm:text-4xl">Profile</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#6c6a64]">
            Update the name and profile image people see when you collaborate on forms.
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
          {profileQuery.data ? <ProfileForm initialProfile={profileQuery.data} /> : null}
        </div>
      </div>
    </main>
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
