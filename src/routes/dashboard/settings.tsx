import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requireAuth } from '../../lib/server-fns/auth'
import {
  getIntegrationSettings,
  saveXenditSettings,
  savePaypalSettings,
  saveSmtpSettings,
  deleteIntegration,
} from '../../lib/server-fns/integrations'
import type { IntegrationSettingsView } from '../../lib/integrations/types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: () => requireAuth(),
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['integration-settings'],
    queryFn: () => getIntegrationSettings(),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['integration-settings'] })

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-2">
        <h1 className="text-3xl font-medium text-[#141413]">Settings</h1>
        <p className="mt-1 text-[#6c6a64]">
          Connect your own payment and email accounts. Keys are encrypted before
          they touch the database — we never store them in plain text.
        </p>
      </div>

      {isLoading || !settings ? (
        <div className="mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-[#efe9de]" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <XenditSection view={settings} onSaved={invalidate} />
          <PaypalSection view={settings} onSaved={invalidate} />
          <SmtpSection view={settings} onSaved={invalidate} />
        </div>
      )}
    </div>
  )
}

// ── Shared bits ──

function SectionHeader({
  title,
  subtitle,
  configured,
}: {
  title: string
  subtitle: string
  configured: boolean
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-[#141413]">{title}</h2>
        <p className="mt-0.5 text-sm text-[#6c6a64]">{subtitle}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          configured
            ? 'bg-[#dcefdc] text-[#2f6f3f]'
            : 'bg-[#efe9de] text-[#8e8b82]'
        }`}
      >
        {configured ? 'Connected' : 'Not set up'}
      </span>
    </div>
  )
}

function Feedback({ error, ok }: { error?: string | null; ok?: boolean }) {
  if (error) return <p className="text-sm text-[#c64545]">{error}</p>
  if (ok) return <p className="text-sm text-[#2f6f3f]">Saved.</p>
  return null
}

// ── Xendit ──

function XenditSection({
  view,
  onSaved,
}: {
  view: IntegrationSettingsView
  onSaved: () => void
}) {
  const x = view.xendit
  const [secretKey, setSecretKey] = useState('')
  const [webhookToken, setWebhookToken] = useState('')

  const save = useMutation({
    mutationFn: () =>
      saveXenditSettings({ data: { secretKey, webhookToken } }),
    onSuccess: () => {
      setSecretKey('')
      onSaved()
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteIntegration({ data: { provider: 'xendit' } }),
    onSuccess: onSaved,
  })

  return (
    <Card className="!p-6">
      <SectionHeader
        title="Xendit"
        subtitle="Accept payments through your own Xendit account."
        configured={x.configured}
      />
      <div className="space-y-4">
        <Input
          label="Secret API key"
          type="password"
          autoComplete="off"
          placeholder={x.configured ? `Saved (${x.secretKeyMask}) — leave blank to keep` : 'xnd_production_...'}
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
        />
        <Input
          label="Webhook verification token (optional)"
          type="password"
          autoComplete="off"
          placeholder={x.hasWebhookToken ? 'Saved — leave blank to keep' : 'Optional'}
          value={webhookToken}
          onChange={(e) => setWebhookToken(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || (!x.configured && !secretKey)}
          >
            {save.isPending ? 'Saving…' : 'Save Xendit'}
          </Button>
          {x.configured && (
            <Button
              variant="text-link"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Remove
            </Button>
          )}
          <Feedback
            error={save.error ? (save.error as Error).message : null}
            ok={save.isSuccess}
          />
        </div>
      </div>
    </Card>
  )
}

// ── PayPal ──

function PaypalSection({
  view,
  onSaved,
}: {
  view: IntegrationSettingsView
  onSaved: () => void
}) {
  const p = view.paypal
  const [clientId, setClientId] = useState(p.clientId ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [mode, setMode] = useState<'sandbox' | 'live'>(p.mode)

  const save = useMutation({
    mutationFn: () =>
      savePaypalSettings({ data: { clientId, clientSecret, mode } }),
    onSuccess: () => {
      setClientSecret('')
      onSaved()
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteIntegration({ data: { provider: 'paypal' } }),
    onSuccess: () => {
      setClientId('')
      onSaved()
    },
  })

  return (
    <Card className="!p-6">
      <SectionHeader
        title="PayPal"
        subtitle="Accept payments through your own PayPal business account."
        configured={p.configured}
      />
      <div className="space-y-4">
        <Input
          label="Client ID"
          autoComplete="off"
          placeholder="AYSq3RDGsmBLJE..."
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <Input
          label="Client secret"
          type="password"
          autoComplete="off"
          placeholder={p.configured ? `Saved (${p.clientSecretMask}) — leave blank to keep` : 'EGnHDxD_qRPdaLd...'}
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#141413]">Environment</label>
          <select
            className="h-10 rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c]"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'sandbox' | 'live')}
          >
            <option value="sandbox">Sandbox (testing)</option>
            <option value="live">Live (production)</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !clientId}
          >
            {save.isPending ? 'Saving…' : 'Save PayPal'}
          </Button>
          {p.configured && (
            <Button
              variant="text-link"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Remove
            </Button>
          )}
          <Feedback
            error={save.error ? (save.error as Error).message : null}
            ok={save.isSuccess}
          />
        </div>
      </div>
    </Card>
  )
}

// ── SMTP ──

function SmtpSection({
  view,
  onSaved,
}: {
  view: IntegrationSettingsView
  onSaved: () => void
}) {
  const s = view.smtp
  const [host, setHost] = useState(s.host ?? '')
  const [port, setPort] = useState(String(s.port ?? 587))
  const [secure, setSecure] = useState(s.secure)
  const [user, setUser] = useState(s.user ?? '')
  const [password, setPassword] = useState('')
  const [fromEmail, setFromEmail] = useState(s.fromEmail ?? '')
  const [fromName, setFromName] = useState(s.fromName ?? '')

  const save = useMutation({
    mutationFn: () =>
      saveSmtpSettings({
        data: {
          host,
          port: Number(port) || 587,
          secure,
          user,
          password,
          fromEmail,
          fromName,
        },
      }),
    onSuccess: () => {
      setPassword('')
      onSaved()
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteIntegration({ data: { provider: 'smtp' } }),
    onSuccess: onSaved,
  })

  return (
    <Card className="!p-6">
      <SectionHeader
        title="SMTP / Email"
        subtitle="Send form notifications and receipts from your own mail server."
        configured={s.configured}
      />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              label="Host"
              autoComplete="off"
              placeholder="smtp.gmail.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <Input
            label="Port"
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
        <Input
          label="Username"
          autoComplete="off"
          placeholder="you@example.com"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder={s.passwordSet ? 'Saved — leave blank to keep' : 'App password or SMTP password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="From email"
            type="email"
            autoComplete="off"
            placeholder="noreply@example.com"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
          <Input
            label="From name (optional)"
            autoComplete="off"
            placeholder="Your Company"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#141413]">
          <input
            type="checkbox"
            checked={secure}
            onChange={(e) => setSecure(e.target.checked)}
          />
          Use TLS/SSL (recommended for port 465)
        </label>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !host || !fromEmail}
          >
            {save.isPending ? 'Saving…' : 'Save SMTP'}
          </Button>
          {s.configured && (
            <Button
              variant="text-link"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              Remove
            </Button>
          )}
          <Feedback
            error={save.error ? (save.error as Error).message : null}
            ok={save.isSuccess}
          />
        </div>
      </div>
    </Card>
  )
}
