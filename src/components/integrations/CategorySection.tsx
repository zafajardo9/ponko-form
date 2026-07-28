import { ProviderCard } from './ProviderCard'
import { PROVIDER_FORMS, CATEGORIES } from './ProviderForms'
import type { ProviderSlug, IntegrationStatus } from '../../lib/integrations/types'

interface CategorySectionProps {
  categoryKey: string
  statuses: IntegrationStatus[]
  onConfigure: (provider: ProviderSlug) => void
  onRemove: (provider: ProviderSlug) => void
}

export function CategorySection({ categoryKey, statuses, onConfigure, onRemove }: CategorySectionProps) {
  const cat = CATEGORIES.find((c) => c.key === categoryKey)
  if (!cat) return null

  const providers = Object.entries(PROVIDER_FORMS).filter(
    ([_, cfg]) => cfg.category === categoryKey && !cfg.planned,
  )

  if (providers.length === 0) return null

  const description = {
    payments: 'Accept and track payments directly through your forms.',
    email: 'Deliver payment reminders, confirmations, and notifications.',
    'data-export': 'Send form responses to the tools where your team works.',
    ai: 'Add intelligent generation and assistance to your workflows.',
    scheduling: 'Connect form responses with appointments and calendars.',
    'file-storage': 'Store and transform uploaded files and media.',
    security: 'Protect public forms from automated spam and abuse.',
  }[categoryKey]

  return (
    <section id={`integration-${categoryKey}`} className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-[#dedbd5] pb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#141413]">{cat.label}</h2>
          <p className="mt-1 text-sm text-[#77736c]">{description}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[#8e8b82]">
          {providers.length} {providers.length === 1 ? 'integration' : 'integrations'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {providers.map(([slug, _]) => {
          const status = statuses.find((s) => s.provider === slug)
          return (
            <ProviderCard
              key={slug}
              provider={slug as ProviderSlug}
              configured={status?.configured ?? false}
              meta={status?.meta}
              onConfigure={() => onConfigure(slug as ProviderSlug)}
              onRemove={() => onRemove(slug as ProviderSlug)}
            />
          )
        })}
      </div>
    </section>
  )
}
