import { ChevronDown, ClipboardCheck, Database, Mail } from 'lucide-react'

export interface SubmissionDetail {
  label: string
  value: string
}

interface FormSuccessCardProps {
  /** Optional heading rendered above the message. */
  title?: string
  /** Confirmation message shown under the check badge. */
  message: string
  /** Optional support email; renders a "Contact us" block when present. */
  supportEmail?: string | null
  /** When true, wraps the content in the bordered confirmation box used on the final page. */
  bordered?: boolean
  /** Database-backed response reference returned after persistence succeeds. */
  reference?: string | null
  /** Respondent-safe values available for an optional receipt-style review. */
  details?: SubmissionDetail[]
}

/**
 * Respondent-facing thank-you confirmation. Used on the final page (inside the
 * form card) and on the completion screen after a submission lands. The check
 * badge pops in and draws itself using the form's theme accent; the contact
 * block appears whenever the creator configured a support email.
 */
export function FormSuccessCard({
  title,
  message,
  supportEmail,
  bordered = false,
  reference,
  details = [],
}: FormSuccessCardProps) {
  const content = (
    <>
      <div className="ponko-success-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ponko-primary-soft,#cc785c29)] motion-reduce:animate-none">
        <svg viewBox="0 0 52 52" className="h-8 w-8" aria-hidden="true" focusable="false">
          <circle cx="26" cy="26" r="24" fill="none" stroke="var(--ponko-primary,#cc785c)" strokeWidth="3.5" />
          <path
            fill="none"
            stroke="var(--ponko-primary,#cc785c)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.5 27l7.5 7.5L37.5 18.5"
            className="ponko-success-check"
          />
        </svg>
      </div>

      {title && (
        <h1
          className="ponko-success-rise mt-5 text-2xl font-medium text-[#141413] motion-reduce:animate-none"
          style={{ animationDelay: '60ms' }}
        >
          {title}
        </h1>
      )}

      <p
        className="ponko-success-rise mx-auto mt-2 max-w-md whitespace-pre-wrap text-[#6c6a64] motion-reduce:animate-none"
        style={{ animationDelay: '120ms' }}
      >
        {message}
      </p>

      {reference && (
        <div
          className="ponko-success-rise mx-auto mt-7 max-w-lg overflow-hidden rounded-[var(--ponko-radius-card,16px)] border border-[var(--ponko-primary-soft,#cc785c29)] bg-white text-left shadow-sm motion-reduce:animate-none"
          style={{ animationDelay: '180ms' }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-[var(--ponko-primary-soft,#cc785c29)] bg-[var(--ponko-primary-soft,#cc785c29)] px-4 py-3 sm:px-5">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ponko-primary,#a9583e)]">
              <Database size={15} aria-hidden="true" />
              Response recorded
            </span>
            <span className="font-mono text-xs font-semibold tracking-[0.08em] text-[var(--ponko-primary,#a9583e)]">{reference}</span>
          </div>
          {details.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[#38342f] hover:bg-[var(--ponko-primary-soft,#cc785c29)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ponko-primary,#cc785c)] sm:px-5">
                Review submitted details
                <ChevronDown size={16} className="text-[#8e8b82] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <SubmissionDetails details={details} />
            </details>
          )}
        </div>
      )}

      {supportEmail && (
        <div
          className="ponko-success-rise mx-auto mt-8 max-w-md rounded-[var(--ponko-radius-card,16px)] border border-[var(--ponko-primary-soft,#cc785c29)] bg-[var(--ponko-bg,#faf9f5)] px-5 py-4 motion-reduce:animate-none"
          style={{ animationDelay: reference ? '240ms' : '180ms' }}
        >
          <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#141413]">
            <Mail size={15} className="shrink-0 text-[#8e8b82]" />
            Need help?
          </div>
          <p className="mt-1.5 text-center text-sm leading-relaxed text-[#6c6a64]">
            If something went wrong with your response, our team is happy to help. Reach us at{' '}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-[var(--ponko-primary,#cc785c)] underline decoration-[var(--ponko-primary,#cc785c)]/40 underline-offset-2 transition-opacity hover:opacity-80"
            >
              {supportEmail}
            </a>
          </p>
        </div>
      )}
    </>
  )

  if (!bordered) return content

  return (
    <div className="rounded-[var(--ponko-radius-card,16px)] border border-[var(--ponko-primary-soft,#cc785c29)] bg-[var(--ponko-bg,#faf9f5)] px-5 py-8 text-center sm:px-8 sm:py-10">
      {content}
    </div>
  )
}

export function SubmissionReviewCard({ details }: { details: SubmissionDetail[] }) {
  return (
    <section className="mx-auto w-full max-w-lg overflow-hidden rounded-[var(--ponko-radius-card,16px)] border border-[var(--ponko-primary-soft,#cc785c29)] bg-white shadow-sm" aria-labelledby="submission-review-title">
      <div className="flex items-start gap-2.5 border-b border-[var(--ponko-primary-soft,#cc785c29)] bg-[var(--ponko-primary-soft,#cc785c29)] px-3.5 py-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[var(--ponko-radius,8px)] bg-white/70 text-[var(--ponko-primary,#a9583e)]">
          <ClipboardCheck size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="submission-review-title" className="text-sm font-semibold text-[#282622]">Review before submitting</h3>
          <p className="mt-0.5 text-xs leading-4 text-[#6c6a64]">Check your details, then submit to record them.</p>
        </div>
      </div>
      {details.length > 0 ? (
        <SubmissionDetails details={details} compact />
      ) : (
        <p className="px-3.5 py-3 text-sm text-[#77736b]">No response details were entered.</p>
      )}
      <div className="flex items-center gap-2 border-t border-[var(--ponko-primary-soft,#cc785c29)] bg-[var(--ponko-primary-soft,#cc785c29)] px-3.5 py-2.5 text-xs font-medium text-[var(--ponko-primary,#a9583e)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--ponko-primary,#cc785c)]" aria-hidden="true" />
        Not submitted yet
      </div>
    </section>
  )
}

function SubmissionDetails({ details, compact = false }: { details: SubmissionDetail[]; compact?: boolean }) {
  return (
    <dl className={`${compact ? 'max-h-44' : 'max-h-72'} divide-y divide-[var(--ponko-primary-soft,#cc785c29)] overflow-y-auto overscroll-contain border-t border-[var(--ponko-primary-soft,#cc785c29)] px-3.5 sm:px-4`}>
      {details.map((detail, index) => (
        <div key={`${detail.label}-${index}`} className={`grid gap-0.5 ${compact ? 'py-2.5' : 'py-3'} sm:grid-cols-[minmax(110px,0.65fr)_minmax(0,1fr)] sm:gap-3`}>
          <dt className="text-xs font-medium text-[#8e8b82]">{detail.label}</dt>
          <dd className="break-words text-sm leading-5 text-[#38342f] sm:text-right">{detail.value}</dd>
        </div>
      ))}
    </dl>
  )
}
