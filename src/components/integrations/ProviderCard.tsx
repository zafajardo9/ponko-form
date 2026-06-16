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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#e6dfd8] bg-white p-4 transition-colors hover:border-[#cc785c]/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#f5f0e8] text-lg">
            {cfg.icon}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-[#141413]">{cfg.name}</div>
            <div className="text-xs text-[#6c6a64]">{cfg.description}</div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
            configured
              ? 'bg-[#dcefdc] text-[#2f6f3f]'
              : 'bg-[#efe9de] text-[#8e8b82]'
          }`}
        >
          {configured ? 'Connected' : 'Off'}
        </span>
      </div>

      {configured && meta && Object.keys(meta).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8e8b82]">
          {Object.entries(meta).map(([key, val]) => (
            <span key={key}>
              {key}: <span className="text-[#6c6a64]">{val}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onConfigure}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            configured
              ? 'border border-[#e6dfd8] bg-[#faf9f5] text-[#141413] hover:bg-[#f5f0e8]'
              : 'bg-[#cc785c] text-white hover:bg-[#a9583e]'
          }`}
        >
          {configured ? 'Edit' : 'Configure'}
        </button>
        {configured && (
          <button
            onClick={onRemove}
            className="rounded-md px-2 py-1.5 text-xs text-[#8e8b82] hover:text-[#c64545]"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
