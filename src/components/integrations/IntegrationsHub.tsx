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
      <div className="flex flex-col gap-8">
        {CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex flex-col gap-4">
            <div className="h-6 w-40 animate-pulse rounded bg-[#efe9de]" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-[#efe9de]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-10">
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

      <IntegrationModal
        provider={modalProvider!}
        open={modalProvider !== null}
        onClose={() => setModalProvider(null)}
        onSave={handleSave}
        configured={statuses.find((s) => s.provider === modalProvider)?.configured ?? false}
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
