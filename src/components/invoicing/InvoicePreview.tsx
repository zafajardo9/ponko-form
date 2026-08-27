import type { EmailTemplateKind, EmailTemplateSnapshot } from '../../db/schema'
import type { TemplateVariable } from '../../lib/invoicing/types'
import { renderTemplateMessage, sampleContext } from '../../lib/invoicing/template'

export function InvoicePreview({
  kind,
  snapshot,
  variables,
}: {
  kind: EmailTemplateKind
  snapshot: EmailTemplateSnapshot
  variables: TemplateVariable[]
}) {
  // Render through the same code path as the real email so the preview always
  // matches what gets sent (sanitization, accent color, layout).
  const message = renderTemplateMessage(kind, snapshot, sampleContext(variables))
  return (
    <section aria-label="Email preview" className="overflow-hidden rounded-xl border border-[#e6dfd8] bg-white">
      <div className="border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[#8e8b82]">Subject</p>
        <p className="mt-1 truncate text-sm font-medium text-[#141413]">{message.subject}</p>
      </div>
      <iframe
        title={`${kind} email preview`}
        sandbox=""
        srcDoc={message.html}
        className="h-[620px] w-full bg-white"
      />
    </section>
  )
}
