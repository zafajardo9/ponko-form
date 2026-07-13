import { PROVIDER_FORMS, type ProviderFormConfig } from './providerForms'
import type { ProviderSlug } from '../../lib/integrations/types'

interface ProviderCardProps {
  provider: ProviderSlug
  configured: boolean
  meta?: Record<string, string>
  onConfigure: () => void
  onRemove: () => void
}

export function ProviderCard({ provider, configured, meta, onConfigure, onRemove }: ProviderCardProps) {
  const cfg: ProviderFormConfig | undefined = PROVIDER_FORMS[provider]
  if (!cfg) return null

  const visibleMeta = Object.entries(meta ?? {}).filter(([key, value]) =>
    Boolean(value) && key !== 'webhookPath',
  )
  const metaLabel = (key: string) => ({
    mode: 'Environment',
    host: 'Host',
    fromEmail: 'Sender',
    fromName: 'Name',
    sandboxConfigured: 'Test credentials',
    liveConfigured: 'Live credentials',
  })[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
  const metaValue = (key: string, value: string) =>
    key === 'mode'
      ? value === 'live' ? 'Live' : 'Sandbox / Test'
      : key === 'sandboxConfigured' || key === 'liveConfigured'
        ? value === 'true' ? 'Saved' : 'Not configured'
      : value

  return (
    <article className="group flex min-h-48 flex-col rounded-xl border border-[#dedbd5] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,19,0.03)] transition hover:border-[#c9c4bc] hover:shadow-[0_10px_30px_-20px_rgba(20,20,19,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold text-[#141413]">{cfg.name}</h3>
            <span className={`h-1.5 w-1.5 rounded-full ${configured ? 'bg-[#3f8a50]' : 'bg-[#c8c4bd]'}`} aria-hidden="true" />
          </div>
          <p className="mt-2 text-sm leading-5 text-[#6c6a64]">{cfg.description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
            configured
              ? 'border-[#c9e2ce] bg-[#f0f8f2] text-[#357143]'
              : 'border-[#e4e0da] bg-[#f8f6f2] text-[#817d75]'
          }`}
        >
          {configured ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {configured && visibleMeta.length > 0 && (
        <dl className="mt-4 grid gap-1.5 border-t border-[#eeeae4] pt-3 text-xs">
          {visibleMeta.map(([key, val]) => (
            <div key={key} className="flex min-w-0 justify-between gap-4">
              <dt className="text-[#8e8b82]">{metaLabel(key)}</dt>
              <dd className="truncate text-right font-medium text-[#57544d]">{metaValue(key, val)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-auto flex items-center gap-2 pt-5">
        <button
          onClick={onConfigure}
          className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
            configured
              ? 'border border-[#dcd8d1] bg-white text-[#141413] hover:bg-[#f7f5f1]'
              : 'bg-[#141413] text-white hover:bg-[#34332f]'
          }`}
        >
          {configured ? 'Manage' : 'Connect'}
        </button>
        {configured && (
          <button
            onClick={onRemove}
            className="rounded-md px-3 py-2 text-xs font-medium text-[#817d75] hover:bg-[#fff3f1] hover:text-[#b64336]"
          >
            Disconnect
          </button>
        )}
      </div>
    </article>
  )
}
