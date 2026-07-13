import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { PROVIDER_FORMS, type ProviderFormConfig } from './providerForms'
import type { ProviderSlug } from '../../lib/integrations/types'
import { getGoogleAuthUrl } from '../../lib/server-fns/google-oauth'

interface IntegrationModalProps {
  provider: ProviderSlug
  open: boolean
  onClose: () => void
  onSave: (provider: ProviderSlug, config: Record<string, unknown>) => void
  onOAuth?: (provider: ProviderSlug) => void
  saving?: boolean
  error?: string | null
  /** Whether this provider already has credentials saved. */
  configured?: boolean
  meta?: Record<string, string>
}

const OAUTH_PROVIDERS: ProviderSlug[] = ['google-sheets', 'google-calendar']

const inputClass =
  'h-10 w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 text-sm text-[#141413] outline-none placeholder:text-[#8e8b82] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 transition-colors'

const selectClass =
  'h-10 w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c]'

export function IntegrationModal({ provider, open, onClose, onSave, onOAuth, saving, error, configured, meta }: IntegrationModalProps) {
  const cfg: ProviderFormConfig | undefined = PROVIDER_FORMS[provider]
  const [config, setConfig] = useState<Record<string, string>>({})
  const [oauthUrl, setOauthUrl] = useState<string | null>(null)

  const isOAuth = OAUTH_PROVIDERS.includes(provider)

  // Fetch the OAuth URL once when the modal opens for an OAuth provider
  useEffect(() => {
    if (open && isOAuth) {
      getGoogleAuthUrl().then((res) => {
        if (res.url) setOauthUrl(res.url)
      })
    }
  }, [open, provider])

  if (!open || !cfg) return null

  const isPaymentEnvironmentProvider = provider === 'xendit' || provider === 'paypal'
  const activeEnvironment = (config.mode ?? meta?.mode?.toLowerCase() ?? 'sandbox') as 'sandbox' | 'live'
  const persistedEnvironment = configured
    ? (meta?.mode?.toLowerCase() === 'live' ? 'live' : 'sandbox')
    : null
  const environmentChanged = Boolean(persistedEnvironment && activeEnvironment !== persistedEnvironment)
  const activeEnvironmentSaved = meta?.[`${activeEnvironment}Configured`] === 'true'
  const environmentOptions = cfg.fields.find((field) => field.name === 'mode')?.options ?? []
  const visibleFields = cfg.fields.filter(
    (field) => !(isPaymentEnvironmentProvider && field.name === 'mode'),
  )

  function update(key: string, value: string) {
    setConfig((c) => ({ ...c, [key]: value }))
  }

  function handleSave() {
    const withDefaults = { ...config }
    for (const field of cfg.fields) {
      if (field.type === 'select' && !withDefaults[field.name]) {
        withDefaults[field.name] = meta?.[field.name]?.toLowerCase() ?? field.placeholder ?? ''
      }
    }
    onSave(provider, withDefaults)
    setConfig({})
  }

  function handleClose() {
    setConfig({})
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[#f5f0e8] shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between rounded-t-xl border-b border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <div className="flex items-center gap-2">
            <div>
              <span className="block text-sm font-semibold text-[#141413]">{cfg.name}</span>
              <span className="block text-xs text-[#8e8b82]">Integration settings</span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {configured && !isPaymentEnvironmentProvider && (
            <div className="flex items-center gap-2 rounded-lg bg-[#dcefdc] px-3 py-2 text-sm font-medium text-[#2f6f3f]">
              ✓ Connected
            </div>
          )}
          <p className="text-sm text-[#6c6a64]">{cfg.description}</p>
          {isPaymentEnvironmentProvider && (
            <section className="rounded-xl border border-[#ddd8d0] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#141413]">Payment environment</h3>
                  <p className="mt-0.5 text-xs text-[#8e8b82]">
                    {configured
                      ? `Currently active: ${persistedEnvironment === 'live' ? 'Live' : 'Test / Sandbox'}`
                      : 'Choose where payments should run.'}
                  </p>
                </div>
                {configured && (
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    persistedEnvironment === 'live'
                      ? 'bg-[#dcefdc] text-[#2f6f3f]'
                      : 'bg-[#dcebf4] text-[#315f7d]'
                  }`}>
                    {persistedEnvironment === 'live' ? 'Live active' : 'Test active'}
                  </span>
                )}
              </div>

              <div role="radiogroup" aria-label="Environment" className="mt-3 grid grid-cols-2 rounded-lg bg-[#efebe5] p-1">
                {environmentOptions.map((option) => {
                  const selected = activeEnvironment === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setConfig({ mode: option.value })}
                      className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                        selected
                          ? 'bg-white text-[#141413] shadow-sm'
                          : 'text-[#77736c] hover:text-[#141413]'
                      }`}
                    >
                      {option.value === 'live' ? 'Live' : 'Test / Sandbox'}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className={activeEnvironmentSaved ? 'text-[#357143]' : 'text-[#a25b45]'}>
                  {activeEnvironmentSaved ? 'Credentials saved' : 'Credentials required'}
                </span>
                <span className="text-[#8e8b82]">
                  {activeEnvironment === 'live' ? 'Real transactions' : 'No real charges'}
                </span>
              </div>

              {environmentChanged && (
                <p className="mt-3 border-t border-[#eeeae4] pt-3 text-xs leading-relaxed text-[#8a641f]" role="alert">
                  {persistedEnvironment === 'live' ? 'Live' : 'Test'} stays active until you save and activate {activeEnvironment === 'live' ? 'Live' : 'Test'}.
                </p>
              )}
            </section>
          )}
          {provider === 'xendit' && meta?.webhookPath && (
            <details className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5 text-xs text-[#6c6a64]">
              <summary className="cursor-pointer font-medium text-[#141413]">Webhook setup</summary>
              <code className="mt-2 block break-all select-all rounded bg-white p-2">
                {typeof window === 'undefined' ? meta.webhookPath : `${window.location.origin}${meta.webhookPath}`}
              </code>
              <p className="mt-2">Use this URL for Xendit invoice and refund webhooks.</p>
            </details>
          )}

          {isOAuth ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 text-sm text-[#6c6a64]">
                <p>Enter your own Google Cloud OAuth credentials below. You'll need a Google Cloud project with the Sheets API enabled.</p>
              </div>

              {/* OAuth credential fields — always shown */}
              <div className="flex flex-col gap-3.5">
                {cfg.fields.map((field) => (
                  <div key={field.name} className="flex flex-col gap-1">
                    <label htmlFor={`integration-${provider}-${field.name}`} className="text-sm font-medium text-[#141413]">
                      {field.label}
                      {field.required && <span className="ml-0.5 text-[#c64545]">*</span>}
                    </label>
                    <input
                      id={`integration-${provider}-${field.name}`}
                      type={field.type}
                      value={config[field.name] ?? ''}
                      onChange={(e) => update(field.name, e.target.value)}
                      placeholder={configured && field.type === 'password' ? 'Saved — leave blank to keep' : (field.placeholder ?? '')}
                      autoComplete="off"
                      className={inputClass}
                    />
                    {field.docLink && (
                      <a href={field.docLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[#cc785c] hover:underline">
                        Where to find this →
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Connect with Google button — only if configured */}
              {configured && oauthUrl ? (
                <a
                  href={oauthUrl}
                  onClick={(e) => {
                    e.preventDefault()
                    window.open(oauthUrl, 'google-oauth', 'width=600,height=700')
                    onOAuth?.(provider)
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[#e6dfd8] bg-white px-4 py-3 text-sm font-medium text-[#141413] hover:bg-[#f5f0e8] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  {configured ? 'Reconnect with Google' : 'Connect with Google'}
                </a>
              ) : configured && !oauthUrl ? (
                <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 text-sm text-[#6c6a64]">
                  Click "Save Integration" first, then connect with Google.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
            {isPaymentEnvironmentProvider && (
              <div className="flex items-center justify-between border-b border-[#e6dfd8] pb-2">
                <p className="text-sm font-semibold text-[#141413]">
                  {activeEnvironment === 'live' ? 'Live' : 'Test'} credentials
                </p>
                <span className="text-xs text-[#8e8b82]">
                  {activeEnvironmentSaved ? 'Saved' : 'Not saved'}
                </span>
              </div>
            )}
            {visibleFields.map((field) => (
              <div key={field.name} className="flex flex-col gap-1">
                <label htmlFor={`integration-${provider}-${field.name}`} className="text-sm font-medium text-[#141413]">
                  {field.label}
                  {field.required && <span className="ml-0.5 text-[#c64545]">*</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    id={`integration-${provider}-${field.name}`}
                    value={config[field.name] ?? meta?.[field.name]?.toLowerCase() ?? field.placeholder ?? ''}
                    onChange={(e) => update(field.name, e.target.value)}
                    className={selectClass}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`integration-${provider}-${field.name}`}
                    type={field.type}
                    value={config[field.name] ?? ''}
                    onChange={(e) => update(field.name, e.target.value)}
                    placeholder={
                      field.type === 'password' && configured && (!isPaymentEnvironmentProvider || activeEnvironmentSaved)
                        ? `Saved for ${activeEnvironment === 'live' ? 'Live' : 'Test'} — leave blank to keep`
                        : (field.placeholder ?? '')
                    }
                    autoComplete="off"
                    className={inputClass}
                  />
                )}

                {field.docLink && (
                  <a
                    href={field.docLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#cc785c] hover:underline"
                  >
                    Where to find this →
                  </a>
                )}
              </div>
            ))}
          </div>
          )}
          {cfg.docsUrl && (
            <a
              href={cfg.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-xs text-[#6c6a64] hover:text-[#141413]"
            >
              📖 View {cfg.name} setup guide ↗
            </a>
          )}

          {error && <p className="text-sm text-[#c64545]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 rounded-b-xl border-t border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving
              ? 'Saving…'
              : isPaymentEnvironmentProvider
                ? environmentChanged
                  ? `Save & activate ${activeEnvironment === 'live' ? 'Live' : 'Test'}`
                  : `Save ${activeEnvironment === 'live' ? 'Live' : 'Test'} credentials`
                : 'Save Integration'}
          </Button>
        </div>
      </div>
    </div>
  )
}
