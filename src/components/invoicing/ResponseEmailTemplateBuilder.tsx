import { useState } from 'react'
import {
  Check,
  Eye,
  Mail,
  Plus,
  Settings2,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import type { EmailTemplateSnapshot, ResponseEmailTemplate } from '../../db/schema'
import type { ConfirmationConfigDraft, TemplateVariable } from '../../lib/invoicing/types'
import { appConfig } from '../../utils/app-config'
import { PreviewDialog } from '../ui/PreviewDialog'
import { InvoicePreview } from './InvoicePreview'
import { TemplateRichTextEditor } from './TemplateRichTextEditor'

const inputClass =
  'h-10 w-full rounded-md border border-[#ded8cf] bg-white px-3 text-sm text-[#141413] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15 disabled:bg-[#f5f0e8] disabled:text-[#8e8b82]'
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type EditorTab = 'email' | 'recipients' | 'advanced'

export function createResponseEmailTemplate(index: number): ResponseEmailTemplate {
  return {
    id: `email-${Date.now()}-${index}`,
    name: `Email content ${index}`,
    enabled: false,
    recipientMode: 'field',
    respondentEmailField: '',
    recipientEmail: '',
    subjectTemplate: 'Thanks for submitting {{form_title}}',
    bodyTemplate:
      '<h1>Thank you</h1><p>We received your response for <strong>{{form_title}}</strong>.</p>',
    fromName: '',
    ccRecipients: [],
  }
}

export function ResponseEmailTemplateBuilder({
  confirmation,
  variables,
  hasEmailIntegration,
  selectedTemplateId,
  onSelectTemplate,
  onChange,
}: {
  confirmation: ConfirmationConfigDraft
  variables: TemplateVariable[]
  hasEmailIntegration: boolean
  selectedTemplateId: string
  onSelectTemplate: (id: string) => void
  onChange: (next: ConfirmationConfigDraft) => void
}) {
  const [activeTab, setActiveTab] = useState<EditorTab>('email')
  const [ccInput, setCcInput] = useState('')
  const [ccError, setCcError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [enableMessage, setEnableMessage] = useState<string | null>(null)
  const templates = confirmation.templates
  const selected = templates.find((template) => template.id === selectedTemplateId) ?? templates[0]
  const emailVariables = variables.filter((variable) => variable.emailCandidate)

  if (!selected) return null

  const recipientReady = selected.recipientMode === 'fixed'
    ? emailPattern.test(selected.recipientEmail)
    : emailVariables.some((variable) => variable.key === selected.respondentEmailField)
  const canEnable = hasEmailIntegration && recipientReady
  const snapshot: EmailTemplateSnapshot = {
    templateName: selected.name,
    subjectTemplate: selected.subjectTemplate,
    bodyTemplate: selected.bodyTemplate,
    fromName: selected.fromName,
    ccRecipients: selected.ccRecipients,
  }

  function updateSelected(patch: Partial<ResponseEmailTemplate>) {
    setEnableMessage(null)
    const nextTemplates = templates.map((template) =>
      template.id === selected.id ? { ...template, ...patch } : template,
    )
    const first = nextTemplates[0]
    onChange({
      ...confirmation,
      enabled: nextTemplates.some((template) => template.enabled),
      respondentEmailField: first?.respondentEmailField ?? '',
      subjectTemplate: first?.subjectTemplate ?? confirmation.subjectTemplate,
      bodyTemplate: first?.bodyTemplate ?? confirmation.bodyTemplate,
      fromName: first?.fromName ?? '',
      ccRecipients: first?.ccRecipients ?? [],
      templates: nextTemplates,
    })
  }

  function addEmail() {
    const next = createResponseEmailTemplate(templates.length + 1)
    onChange({ ...confirmation, templates: [...templates, next] })
    onSelectTemplate(next.id)
    setActiveTab('email')
    setEnableMessage(null)
  }

  function deleteSelected() {
    if (templates.length === 1) return
    const nextTemplates = templates.filter((template) => template.id !== selected.id)
    onChange({
      ...confirmation,
      enabled: nextTemplates.some((template) => template.enabled),
      templates: nextTemplates,
    })
    onSelectTemplate(nextTemplates[0].id)
  }

  function addCcRecipient() {
    const email = ccInput.trim().toLowerCase()
    if (!emailPattern.test(email)) {
      setCcError('Enter a valid email address.')
      return
    }
    if (selected.ccRecipients.some((recipient) => recipient.toLowerCase() === email)) {
      setCcError('That address is already included.')
      return
    }
    if (selected.ccRecipients.length >= 20) {
      setCcError('You can add up to 20 CC recipients.')
      return
    }
    updateSelected({ ccRecipients: [...selected.ccRecipients, email] })
    setCcInput('')
    setCcError(null)
  }

  return (
    <>
      <div className="grid min-h-[610px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-[#ddd5cb] bg-white lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[#e8e2da] bg-[#faf9f5] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-[#e8e2da] px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-[#141413]">Emails</h2>
              <p className="mt-0.5 text-xs text-[#8e8b82]">{templates.length} automation{templates.length === 1 ? '' : 's'}</p>
            </div>
            <button
              type="button"
              aria-label="Add email automation"
              onClick={addEmail}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#d8cec5] bg-white text-[#4f4c46] hover:border-[#c9b9ac] hover:bg-[#fffaf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-2 lg:overflow-visible">
            {templates.map((template) => {
              const active = template.id === selected.id
              const recipient = template.recipientMode === 'fixed'
                ? template.recipientEmail || 'Fixed address not set'
                : variables.find((variable) => variable.key === template.respondentEmailField)?.label
                  ?? 'Recipient field not set'
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelectTemplate(template.id)}
                  className={`min-w-[225px] rounded-lg border p-3 text-left transition-colors lg:min-w-0 lg:w-full ${
                    active
                      ? 'border-[#cc785c] bg-white shadow-sm'
                      : 'border-transparent bg-transparent hover:border-[#e2dbd2] hover:bg-white/70'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[#141413]">{template.name}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${template.enabled ? 'bg-[#4f8758]' : 'bg-[#c9c3ba]'}`} />
                  </span>
                  <span className="mt-1.5 block truncate text-xs text-[#6c6a64]">To: {recipient}</span>
                  <span className="mt-1 block text-[11px] text-[#9a958d]">
                    {template.ccRecipients.length ? `${template.ccRecipients.length} CC recipient${template.ccRecipients.length === 1 ? '' : 's'}` : 'No CC recipients'}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex flex-col gap-3 border-b border-[#e8e2da] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#141413]">{selected.name}</p>
              <p className="mt-0.5 text-xs text-[#8e8b82]">Sent after a successful form submission</p>
            </div>
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d8cec5] bg-white px-3 text-sm font-medium text-[#4f4c46] hover:bg-[#f5f0e8]"
              >
                <Eye size={15} aria-hidden="true" />
                Preview
              </button>
              <div className="flex items-center gap-2.5">
                <span
                  className={`min-w-14 text-right text-xs font-semibold ${
                    selected.enabled ? 'text-[#315f39]' : 'text-[#6c6a64]'
                  }`}
                  aria-live="polite"
                >
                  {selected.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selected.enabled}
                  aria-label={selected.enabled ? 'Disable email automation' : 'Enable email automation'}
                  onClick={() => {
                    if (selected.enabled) {
                      updateSelected({ enabled: false })
                      return
                    }
                    if (!hasEmailIntegration) {
                      setActiveTab('advanced')
                      setEnableMessage('Connect Resend or SMTP before enabling this automation.')
                      return
                    }
                    if (!recipientReady) {
                      setActiveTab('recipients')
                      setEnableMessage('Choose a valid recipient before enabling this automation.')
                      return
                    }
                    updateSelected({ enabled: true })
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 ${
                    selected.enabled
                      ? 'border-[#4f8758] bg-[#4f8758]'
                      : 'border-[#bdb6ad] bg-[#d8d2ca] hover:bg-[#c9c3ba]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      selected.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </header>

          {enableMessage ? (
            <div
              role="alert"
              className="border-b border-[#e2c49f] bg-[#fff8eb] px-4 py-2.5 text-sm text-[#79572e] sm:px-5"
            >
              {enableMessage}
            </div>
          ) : null}

          <div className="border-b border-[#e8e2da] px-4 pt-2 sm:px-5">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Email settings">
              <Tab active={activeTab === 'email'} onClick={() => setActiveTab('email')} icon={<Mail size={14} />}>Email</Tab>
              <Tab active={activeTab === 'recipients'} onClick={() => setActiveTab('recipients')} icon={<Users size={14} />}>Recipients</Tab>
              <Tab active={activeTab === 'advanced'} onClick={() => setActiveTab('advanced')} icon={<Settings2 size={14} />}>Advanced</Tab>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'email' ? (
              <div className="space-y-5">
                <Field label="Subject" required>
                  <input
                    className={inputClass}
                    value={selected.subjectTemplate}
                    maxLength={255}
                    onChange={(event) => updateSelected({ subjectTemplate: event.target.value })}
                  />
                </Field>
                <Field
                  label="Email content"
                  required
                  helper="Use variables to personalize the message or include selected form answers."
                >
                  <TemplateRichTextEditor
                    value={selected.bodyTemplate}
                    variables={variables}
                    onChange={(bodyTemplate) => updateSelected({ bodyTemplate })}
                  />
                </Field>
              </div>
            ) : null}

            {activeTab === 'recipients' ? (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-[#141413]">Send this email to</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <RecipientMode
                      active={selected.recipientMode === 'field'}
                      icon={<UserRound size={17} />}
                      title="Form email field"
                      description="Use an email address submitted in the form."
                      onClick={() => updateSelected({ recipientMode: 'field' })}
                    />
                    <RecipientMode
                      active={selected.recipientMode === 'fixed'}
                      icon={<Mail size={17} />}
                      title="Fixed email address"
                      description="Always send this automation to one address."
                      onClick={() => updateSelected({ recipientMode: 'fixed' })}
                    />
                  </div>
                </div>
                {selected.recipientMode === 'field' ? (
                  <Field label="Recipient email field" required helper="Only Email fields from this form are shown.">
                    <select
                      className={inputClass}
                      value={selected.respondentEmailField}
                      onChange={(event) => updateSelected({ respondentEmailField: event.target.value })}
                    >
                      <option value="">Choose an email field…</option>
                      {emailVariables.map((variable) => (
                        <option key={variable.key} value={variable.key}>{variable.label}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Recipient email address" required helper="This address receives a copy after every submission.">
                    <input
                      type="email"
                      className={inputClass}
                      value={selected.recipientEmail}
                      placeholder="team@example.com"
                      onChange={(event) => updateSelected({ recipientEmail: event.target.value })}
                    />
                  </Field>
                )}

                <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4">
                  <h3 className="text-sm font-semibold text-[#141413]">CC recipients <span className="font-normal text-[#8e8b82]">(optional)</span></h3>
                  <p className="mt-1 text-xs text-[#817d76]">These fixed addresses receive a copy of this email.</p>
                  {selected.ccRecipients.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selected.ccRecipients.map((email) => (
                        <span key={email} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#ded8cf] bg-white py-1 pl-2.5 pr-1 text-xs text-[#4f4c46]">
                          <span className="truncate">{email}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${email}`}
                            onClick={() => updateSelected({ ccRecipients: selected.ccRecipients.filter((item) => item !== email) })}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[#8e8b82] hover:bg-[#f5e4dc] hover:text-[#a33f32]"
                          >
                            <Trash2 size={11} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={ccInput}
                      aria-label="CC email address"
                      placeholder="manager@example.com"
                      className={inputClass}
                      onChange={(event) => { setCcInput(event.target.value); setCcError(null) }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addCcRecipient()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addCcRecipient}
                      disabled={!ccInput.trim()}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#d8cec5] bg-white px-3 text-sm font-medium text-[#4f4c46] hover:bg-[#f5f0e8] disabled:opacity-45"
                    >
                      <Plus size={14} aria-hidden="true" /> Add CC
                    </button>
                  </div>
                  {ccError ? <p className="mt-2 text-xs text-[#a33f32]">{ccError}</p> : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'advanced' ? (
              <div className="space-y-5">
                <Field label="Automation name" required helper={`Used only inside ${appConfig.name}. Recipients will not see it.`}>
                  <input
                    className={inputClass}
                    value={selected.name}
                    maxLength={100}
                    onChange={(event) => updateSelected({ name: event.target.value })}
                  />
                </Field>
                <Field label="From name" optional helper="The sender address comes from your connected email integration.">
                  <input
                    className={inputClass}
                    value={selected.fromName}
                    maxLength={255}
                    placeholder="Your team or business"
                    onChange={(event) => updateSelected({ fromName: event.target.value })}
                  />
                </Field>
                {!canEnable ? (
                  <div className="rounded-lg border border-[#e2c49f] bg-[#fff8eb] px-4 py-3 text-sm leading-5 text-[#79572e]">
                    {!hasEmailIntegration ? 'Connect Resend or SMTP. ' : ''}
                    {!recipientReady ? 'Complete the recipient settings. ' : ''}
                    You can save this email while it is disabled.
                  </div>
                ) : (
                  <p className="inline-flex items-center gap-2 text-sm text-[#3f7048]">
                    <Check size={15} aria-hidden="true" /> This automation is ready to enable.
                  </p>
                )}
                <div className="border-t border-[#eee8df] pt-5">
                  <button
                    type="button"
                    disabled={templates.length === 1}
                    onClick={deleteSelected}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e3c5bd] bg-white px-3 text-sm font-medium text-[#a33f32] hover:bg-[#fff7f5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={14} aria-hidden="true" /> Delete automation
                  </button>
                  {templates.length === 1 ? <p className="mt-2 text-xs text-[#8e8b82]">Keep at least one email automation.</p> : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {previewOpen ? (
        <PreviewDialog title={selected.name} onClose={() => setPreviewOpen(false)}>
          <InvoicePreview kind="confirmation" snapshot={snapshot} variables={variables} />
        </PreviewDialog>
      ) : null}
    </>
  )
}

function Tab({ active, onClick, icon, children }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium ${
        active ? 'border-[#cc785c] text-[#141413]' : 'border-transparent text-[#77736d] hover:text-[#141413]'
      }`}
    >
      {icon}{children}
    </button>
  )
}

function RecipientMode({ active, icon, title, description, onClick }: {
  active: boolean
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${
        active ? 'border-[#cc785c] bg-[#fffaf7]' : 'border-[#e2dbd2] bg-white hover:bg-[#faf9f5]'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-[#141413]">{icon}{title}</span>
      <span className="mt-1 block text-xs leading-4 text-[#817d76]">{description}</span>
    </button>
  )
}

function Field({ label, required, optional, helper, children }: {
  label: string
  required?: boolean
  optional?: boolean
  helper?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium text-[#141413]">
        {label}
        {required ? <span className="text-[#a9583e]">Required</span> : null}
        {optional ? <span className="text-xs font-normal text-[#8e8b82]">Optional</span> : null}
      </span>
      {children}
      {helper ? <span className="mt-1.5 block text-xs leading-4 text-[#8e8b82]">{helper}</span> : null}
    </label>
  )
}
