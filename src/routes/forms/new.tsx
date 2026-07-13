import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { requireAuth } from '../../lib/server-fns/auth'
import { createForm, createFormFromTemplate, getFormTemplates } from '../../lib/server-fns/forms'
import type { FormTemplateRecord } from '../../lib/form-templates/types'
import { TemplateCard } from '../../components/forms/TemplateCard'
import { TemplatePreview } from '../../components/forms/TemplatePreview'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export const Route = createFileRoute('/forms/new')({
  beforeLoad: () => requireAuth(),
  component: NewFormPage,
})

type CreationMode = 'catalog' | 'scratch' | 'template'

function NewFormPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<CreationMode>('catalog')
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplateRecord | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const templatesQuery = useQuery({
    queryKey: ['form-templates'],
    queryFn: () => getFormTemplates(),
  })
  const templates = (templatesQuery.data ?? []) as FormTemplateRecord[]

  function selectTemplate(template: FormTemplateRecord) {
    setSelectedTemplate(template)
    setTitle(template.name)
    setError('')
    setMode('template')
  }

  function selectScratch() {
    setSelectedTemplate(null)
    setTitle('')
    setDescription('')
    setError('')
    setMode('scratch')
  }

  function backToCatalog() {
    setMode('catalog')
    setSelectedTemplate(null)
    setError('')
  }

  async function createSelectedForm(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Form title is required')
      return
    }
    setCreating(true)
    setError('')
    try {
      const form = selectedTemplate
        ? await createFormFromTemplate({ data: { templateId: selectedTemplate.id, title: title.trim() } })
        : await createForm({ data: { title: title.trim(), description: description.trim() || undefined } })
      await navigate({ to: '/forms/$formId/edit', params: { formId: String(form.id) } })
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'Failed to create form. Please try again.')
      setCreating(false)
    }
  }

  if (mode === 'scratch') {
    return (
      <CreationShell title="Start from scratch" description="Create a blank form and build every page your way." onBack={backToCatalog}>
        <form onSubmit={createSelectedForm} className="max-w-2xl rounded-xl border border-[#dedbd5] bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-6">
            <Input label="Form title" placeholder="e.g. Event Registration" value={title} onChange={(event) => { setTitle(event.target.value); setError('') }} error={error} required autoFocus />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#141413]">Description <span className="text-[#8e8b82]">(optional)</span></label>
              <textarea placeholder="What is this form for?" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="resize-none rounded-md border border-[#dedbd5] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] outline-none placeholder:text-[#8e8b82] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20" />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create & open editor'}</Button>
            <Button type="button" variant="secondary" onClick={backToCatalog}>Back</Button>
          </div>
        </form>
      </CreationShell>
    )
  }

  if (mode === 'template' && selectedTemplate) {
    return (
      <CreationShell title={`Create from ${selectedTemplate.name}`} description="Give your form a name. You can customize every page and field afterward." onBack={backToCatalog}>
        <form onSubmit={createSelectedForm} className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.2fr)]">
          <div className="self-start rounded-xl border border-[#dedbd5] bg-white p-6 shadow-sm">
            <Input label="Form title" value={title} onChange={(event) => { setTitle(event.target.value); setError('') }} error={error} required autoFocus />
            <p className="mt-4 text-sm leading-6 text-[#6c6a64]">This template is copied into a new independent form. Changes you make will not affect the original template.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create form'}</Button>
              <Button type="button" variant="secondary" onClick={backToCatalog}>Choose another</Button>
            </div>
          </div>
          <TemplatePreview template={selectedTemplate} />
        </form>
      </CreationShell>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8b82]">Forms</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#141413] sm:text-4xl">Create a new form</h1>
          <p className="mt-3 text-base leading-7 text-[#6c6a64]">Start with a proven structure or create a blank form. Every template is fully editable after creation.</p>
        </div>

        <button type="button" onClick={selectScratch} className="group mt-9 flex w-full items-center justify-between gap-5 rounded-xl border border-[#d6d1ca] bg-[#141413] p-5 text-left text-white shadow-sm transition hover:bg-[#2d2c29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10"><FilePlus2 size={20} /></span>
            <div>
              <h2 className="font-semibold">Start from scratch</h2>
              <p className="mt-1 text-sm text-white/65">A blank form with an input page and confirmation page.</p>
            </div>
          </div>
          <span className="hidden text-sm font-semibold text-white/80 transition group-hover:translate-x-0.5 sm:block">Select →</span>
        </button>

        <div className="mt-12 flex items-end justify-between border-b border-[#dcd8d1] pb-4">
          <div><h2 className="text-xl font-semibold text-[#141413]">Templates</h2><p className="mt-1 text-sm text-[#77736c]">Prebuilt forms for common workflows.</p></div>
          {!templatesQuery.isLoading && <span className="text-xs text-[#8e8b82]">{templates.length} available</span>}
        </div>

        {templatesQuery.isLoading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading form templates">
            {[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-56 animate-pulse rounded-xl border border-[#dedbd5] bg-white" />)}
          </div>
        ) : templatesQuery.isError ? (
          <div className="mt-5 rounded-xl border border-[#e3c5bd] bg-[#fff7f5] p-5 text-sm text-[#8a4034]">Templates could not be loaded. You can still start from scratch.</div>
        ) : templates.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-[#cfc9c0] p-10 text-center text-sm text-[#77736c]">No templates are available yet. Start from scratch to create your form.</div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => <TemplateCard key={template.id} template={template} onClick={() => selectTemplate(template)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function CreationShell({ title, description, onBack, children }: { title: string; description: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f5f1]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-[#6c6a64] hover:text-[#141413]"><ArrowLeft size={16} /> Back to templates</button>
        <div className="mb-8 mt-7 max-w-3xl"><h1 className="text-3xl font-semibold tracking-tight text-[#141413]">{title}</h1><p className="mt-2 text-[#6c6a64]">{description}</p></div>
        {children}
      </div>
    </div>
  )
}
