import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIntegrations, saveIntegration, deleteIntegrationByProvider } from '../../lib/server-fns/integrations'
import { CategorySection } from './CategorySection'
import { IntegrationModal } from './IntegrationModal'
import { PROVIDER_FORMS, CATEGORIES } from './providerForms'
import type { ProviderSlug } from '../../lib/integrations/types'

export function IntegrationsHub() {
  const queryClient = useQueryClient()
  const [modalProvider, setModalProvider] = useState<ProviderSlug | null>(null)

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => getIntegrations(),
  })

  const saveMut = useMutation({
    mutationFn: (data: { provider: ProviderSlug; config: Record<string, unknown> }) =>
      saveIntegration({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setModalProvider(null)
    },
  })

  const removeMut = useMutation({
    mutationFn: (provider: ProviderSlug) =>
      deleteIntegrationByProvider({ data: { provider } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  function handleSave(provider: ProviderSlug, config: Record<string, unknown>) {
    saveMut.mutate({ provider, config })
  }

  function handleRemove(provider: ProviderSlug) {
    if (confirm(`Remove ${PROVIDER_FORMS[provider]?.name ?? provider} integration?`)) {
      removeMut.mutate(provider)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-12" role="status" aria-label="Loading integrations">
        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <div className="mb-4 border-b border-[#e6dfd8] pb-4">
              <div className="h-5 w-32 animate-pulse rounded bg-[#e8e4de]" />
              <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-[#efebe5]" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl border border-[#e6dfd8] bg-white" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const availableProviders = Object.values(PROVIDER_FORMS).filter((provider) => !provider.planned)
  const connectedCount = statuses.filter((status) => status.configured).length

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-xl border border-[#dedbd5] bg-white p-4 shadow-[0_1px_2px_rgba(20,20,19,0.03)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8e8b82]">Overview</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-[#141413]">{connectedCount}</span>
              <span className="text-sm text-[#77736c]">connected</span>
            </div>
            <p className="mt-1 text-xs text-[#8e8b82]">of {availableProviders.length} available integrations</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#eeeae4]">
              <div
                className="h-full rounded-full bg-[#141413] transition-all"
                style={{ width: `${availableProviders.length ? (connectedCount / availableProviders.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <nav className="mt-5 hidden border-l border-[#dedbd5] pl-3 lg:block" aria-label="Integration categories">
            {CATEGORIES.map((category) => (
              <a
                key={category.key}
                href={`#integration-${category.key}`}
                className="block rounded-md px-3 py-2 text-sm text-[#6c6a64] transition hover:bg-white hover:text-[#141413]"
              >
                {category.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-14">
          {CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.key}
              categoryKey={cat.key}
              statuses={statuses}
              onConfigure={setModalProvider}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>

      <IntegrationModal
        provider={modalProvider!}
        open={modalProvider !== null}
        onClose={() => setModalProvider(null)}
        onSave={handleSave}
        configured={statuses.find((s) => s.provider === modalProvider)?.configured ?? false}
        meta={statuses.find((s) => s.provider === modalProvider)?.meta}
        onOAuth={() => {
          // For OAuth providers, poll for completion or close modal
          setModalProvider(null)
        }}
        saving={saveMut.isPending}
        error={saveMut.error ? (saveMut.error as Error).message : null}
      />
    </>
  )
}
