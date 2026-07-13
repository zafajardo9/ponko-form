import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/server-fns/auth'
import { IntegrationsHub } from '../../components/integrations/IntegrationsHub'

export const Route = createFileRoute('/settings/integrations')({
  beforeLoad: () => requireAuth(),
  component: IntegrationsPage,
})

function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="border-b border-[#dcd8d1] pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8b82]">Settings</p>
          <div className="mt-2 max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-[#141413] sm:text-4xl">Integrations</h1>
            <p className="mt-3 text-base leading-7 text-[#6c6a64]">
              Connect the services your team uses for payments, communication, data, scheduling, and storage.
            </p>
          </div>
        </div>
        <div className="mt-8 sm:mt-10">
          <IntegrationsHub />
        </div>
      </div>
    </div>
  )
}
