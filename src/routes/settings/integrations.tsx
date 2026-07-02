import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/server-fns/auth'
import { IntegrationsHub } from '../../components/integrations/IntegrationsHub'

export const Route = createFileRoute('/settings/integrations')({
  beforeLoad: () => requireAuth(),
  component: IntegrationsPage,
})

function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-2">
        <h1 className="text-3xl font-medium text-[#141413]">Integrations</h1>
        <p className="mt-1 text-[#6c6a64]">
          Connect your accounts to extend what your forms can do.
        </p>
      </div>
      <div className="mt-10">
        <IntegrationsHub />
      </div>
    </div>
  )
}
