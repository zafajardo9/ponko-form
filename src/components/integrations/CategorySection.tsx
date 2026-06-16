import { ProviderCard } from './ProviderCard'
import { PROVIDER_FORMS, CATEGORIES } from './providerForms'
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{cat.icon}</span>
        <h2 className="text-base font-semibold text-[#141413]">{cat.label}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  )
}
