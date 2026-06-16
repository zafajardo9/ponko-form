import { Link, createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../lib/server-fns/auth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Puzzle } from 'lucide-react'

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: () => requireAuth(),
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-2">
        <h1 className="text-3xl font-medium text-[#141413]">Settings</h1>
        <p className="mt-1 text-[#6c6a64]">
          Manage your account and connected services.
        </p>
      </div>

      {/* Integrations */}
      <Card className="!p-6 !mt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#141413]">⚡ Integrations</h2>
            <p className="mt-0.5 text-sm text-[#6c6a64]">
              Connect payment gateways (Xendit, PayPal, Stripe, PayMongo, Maya),
              email (SMTP, Resend), AI (Gemini), scheduling (Google Calendar, Calendly),
              file storage (ImageKit, Cloudinary), and more.
            </p>
          </div>
          <Link to="/dashboard/integrations" className="shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5"
              title="Manage integrations"
            >
              <Puzzle size={15} />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
