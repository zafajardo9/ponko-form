import { createFileRoute, Link } from '@tanstack/react-router'
import { Show } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/')({ component: Home })

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="14" rx="2" stroke="#cc785c" strokeWidth="1.5" />
        <line x1="5.5" y1="7" x2="14.5" y2="7" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5.5" y1="10" x2="14.5" y2="10" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5.5" y1="13" x2="10" y2="13" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Drag-and-drop builder',
    description:
      'Add text fields, dropdowns, checkboxes, and more by dragging them onto your canvas. No code required.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="#cc785c" strokeWidth="1.5" />
        <path d="M7 10l2 2 4-4" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Live preview',
    description:
      'See exactly how your form will look to respondents as you build it — no guessing, no surprises.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="16" height="11" rx="1.5" stroke="#cc785c" strokeWidth="1.5" />
        <path d="M6 5V4a2 2 0 014 0v1" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="11" r="1.5" fill="#cc785c" />
      </svg>
    ),
    title: 'Payment collection',
    description:
      'Attach a payment step to any form. Accept money via PayPal or Xendit with one click.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 14l4-4 3 3 4-5 3 3" stroke="#cc785c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Response dashboard',
    description:
      'Every submission lands in your dashboard. Browse, filter, and export responses whenever you need.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2l1.8 5.4H18l-4.9 3.6 1.8 5.4L10 13l-4.9 3.4 1.8-5.4L2 7.4h6.2L10 2z" stroke="#cc785c" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Shareable links',
    description:
      'Publish your form and get a link you can share anywhere — email, social, or embed on your site.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="6" height="6" rx="1" stroke="#cc785c" strokeWidth="1.5" />
        <rect x="11" y="3" width="6" height="6" rx="1" stroke="#cc785c" strokeWidth="1.5" />
        <rect x="3" y="11" width="6" height="6" rx="1" stroke="#cc785c" strokeWidth="1.5" />
        <rect x="11" y="11" width="6" height="6" rx="1" stroke="#cc785c" strokeWidth="1.5" />
      </svg>
    ),
    title: 'Extensible by design',
    description:
      'Add a new payment gateway in a single file. The plugin registry makes integrations clean and fast.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Create a form',
    description: 'Give your form a name and description. Takes 10 seconds.',
  },
  {
    number: '02',
    title: 'Add your fields',
    description: 'Drag text, email, dropdown, checkbox, and more onto your canvas.',
  },
  {
    number: '03',
    title: 'Publish and share',
    description: 'Hit publish and copy the link. Respondents can fill it in immediately.',
  },
  {
    number: '04',
    title: 'Collect responses',
    description: 'Every submission appears in your dashboard in real time.',
  },
]

function Home() {
  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e6dfd8] bg-[#efe9de] px-3.5 py-1.5 text-xs font-medium text-[#6c6a64]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#cc785c]" />
          Now with PayPal &amp; Xendit payment collection
        </div>

        <h1
          className="mx-auto mt-6 max-w-3xl text-5xl font-normal leading-[1.1] tracking-tight text-[#141413] sm:text-6xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Build forms that{' '}
          <em className="not-italic text-[#cc785c]">actually collect</em> what you need
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-[#6c6a64]">
          Drag-and-drop form builder with a live preview, shareable links, and built-in payment
          collection via PayPal and Xendit. No code, no friction.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Show when="signed-out">
            <a
              href="/sign-up/"
              className="inline-flex h-11 items-center rounded-md bg-[#cc785c] px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#a9583e]"
            >
              Start building for free
            </a>
            <a
              href="/sign-in/"
              className="inline-flex h-11 items-center rounded-md border border-[#e6dfd8] bg-white px-6 text-sm font-medium text-[#141413] transition-colors hover:bg-[#f5f0e8]"
            >
              Sign in
            </a>
          </Show>
          <Show when="signed-in">
            <Link
              to="/dashboard"
              className="inline-flex h-11 items-center rounded-md bg-[#cc785c] px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#a9583e]"
            >
              Go to my dashboard
            </Link>
          </Show>
        </div>

        <p className="mt-4 text-sm text-[#8e8b82]">Free to use · No credit card required</p>
      </section>

      {/* ── Form preview mockup ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-[#e6dfd8] bg-white shadow-sm">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 border-b border-[#e6dfd8] bg-[#f5f0e8] px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#e6dfd8]" />
            <span className="h-3 w-3 rounded-full bg-[#e6dfd8]" />
            <span className="h-3 w-3 rounded-full bg-[#e6dfd8]" />
            <div className="ml-4 flex-1 rounded bg-white px-3 py-1 text-xs text-[#8e8b82]">
              ponkoform.app/forms/submit/event-registration
            </div>
          </div>

          {/* Fake form content */}
          <div className="grid grid-cols-1 divide-x divide-[#e6dfd8] lg:grid-cols-3">
            {/* Sidebar palette */}
            <div className="hidden border-r border-[#e6dfd8] bg-[#faf9f5] p-4 lg:block">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Field Types</p>
              {['Text', 'Email', 'Number', 'Dropdown', 'Checkboxes', 'Radio'].map((t) => (
                <div key={t} className="mb-1.5 flex items-center gap-2 rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 text-sm text-[#141413]">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#efe9de] text-xs font-semibold text-[#cc785c]">
                    {t[0]}
                  </span>
                  {t}
                </div>
              ))}
            </div>

            {/* Builder canvas */}
            <div className="bg-[#f5f0e8] p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#141413]">
                <span className="h-2 w-2 rounded-full bg-[#cc785c]" />
                Event Registration
              </div>
              {[
                { label: 'Full name', type: 'Text' },
                { label: 'Email address', type: 'Email' },
                { label: 'Ticket type', type: 'Dropdown' },
              ].map((f, i) => (
                <div
                  key={i}
                  className={`mb-2 rounded-lg border bg-white px-4 py-3 text-sm ${i === 1 ? 'border-[#cc785c] ring-2 ring-[#cc785c]/20' : 'border-[#e6dfd8]'}`}
                >
                  <p className="text-xs text-[#8e8b82]">{f.type}</p>
                  <p className="font-medium text-[#141413]">{f.label}</p>
                </div>
              ))}
              <div className="mt-4 rounded-lg border-2 border-dashed border-[#e6dfd8] py-4 text-center text-xs text-[#8e8b82]">
                Drag fields here
              </div>
            </div>

            {/* Properties panel */}
            <div className="hidden bg-[#faf9f5] p-4 lg:block">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Field Properties</p>
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-[#141413]">Label</p>
                <div className="rounded-md border border-[#cc785c] bg-white px-3 py-2 text-sm text-[#141413] ring-2 ring-[#cc785c]/20">
                  Email address
                </div>
              </div>
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-[#141413]">Placeholder</p>
                <div className="rounded-md border border-[#e6dfd8] bg-white px-3 py-2 text-sm text-[#8e8b82]">
                  you@example.com
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#e6dfd8] bg-white px-3 py-2">
                <span className="text-sm text-[#141413]">Required</span>
                <div className="h-5 w-9 rounded-full bg-[#cc785c]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="bg-[#efe9de] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2
              className="text-4xl font-normal text-[#141413]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Everything you need to collect data
            </h2>
            <p className="mt-4 text-[#6c6a64]">
              From simple contact forms to payment-gated registrations.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-[#e6dfd8] bg-[#faf9f5] p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#efe9de]">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-base font-medium text-[#141413]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#6c6a64]">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2
              className="text-4xl font-normal text-[#141413]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Up and running in minutes
            </h2>
            <p className="mt-4 text-[#6c6a64]">Four steps from zero to collecting responses.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.number} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-8 top-5 hidden h-px w-[calc(100%+2rem)] bg-[#e6dfd8] lg:block" />
                )}
                <div className="relative">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#cc785c] bg-[#faf9f5] text-sm font-semibold text-[#cc785c]">
                    {i + 1}
                  </div>
                  <h3 className="mb-2 text-base font-medium text-[#141413]">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6c6a64]">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Payment section ───────────────────────────────────── */}
      <section className="bg-[#181715] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#252320] bg-[#252320] px-3.5 py-1.5 text-xs font-medium text-[#a09d96]">
                Payment collection
              </div>
              <h2
                className="mb-6 text-4xl font-normal leading-tight text-[#faf9f5]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Collect money alongside your form data
              </h2>
              <p className="mb-8 text-[#a09d96]">
                Enable payments on any form and choose between PayPal or Xendit. Respondents are
                redirected to the payment flow, then back to your thank-you page. Every transaction
                is logged with full status tracking.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3 rounded-xl border border-[#252320] bg-[#252320] px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003087] text-xs font-bold text-white">PP</div>
                  <div>
                    <p className="text-sm font-medium text-[#faf9f5]">PayPal</p>
                    <p className="text-xs text-[#a09d96]">REST API v2</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-[#252320] bg-[#252320] px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0e6baf] text-xs font-bold text-white">X</div>
                  <div>
                    <p className="text-sm font-medium text-[#faf9f5]">Xendit</p>
                    <p className="text-xs text-[#a09d96]">Invoice API</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dark card mockup */}
            <div className="rounded-2xl border border-[#252320] bg-[#1f1e1b] p-6">
              <div className="mb-1 text-xs font-medium text-[#a09d96]">Payment</div>
              <div className="mb-4 text-2xl font-semibold text-[#faf9f5]">$49.00 USD</div>
              <div className="mb-4 flex gap-3">
                <button className="flex-1 rounded-lg bg-[#003087] py-2.5 text-sm font-medium text-white">
                  Pay with PayPal
                </button>
                <button className="flex-1 rounded-lg bg-[#0e6baf] py-2.5 text-sm font-medium text-white">
                  Pay with Xendit
                </button>
              </div>
              <div className="rounded-lg border border-[#252320] bg-[#252320] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-[#a09d96]">Latest transactions</span>
                </div>
                {[
                  { name: 'Maria Santos', status: 'paid', amount: '$49' },
                  { name: 'Alex Reyes', status: 'paid', amount: '$49' },
                  { name: 'James Lim', status: 'pending', amount: '$49' },
                ].map((tx) => (
                  <div key={tx.name} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-[#faf9f5]">{tx.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${tx.status === 'paid' ? 'bg-green-900/50 text-green-400' : 'bg-amber-900/50 text-amber-400'}`}>
                        {tx.status}
                      </span>
                      <span className="text-xs font-medium text-[#faf9f5]">{tx.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="bg-[#cc785c] py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2
            className="mb-4 text-4xl font-normal text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ready to build your first form?
          </h2>
          <p className="mb-10 text-[#f5ddd5]">
            Free to start. No credit card. No setup fees. Just sign up and go.
          </p>
          <Show when="signed-out">
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/sign-up/"
                className="inline-flex h-11 items-center rounded-md bg-white px-6 text-sm font-medium text-[#cc785c] transition-colors hover:bg-[#f5f0e8]"
              >
                Create a free account
              </a>
              <a
                href="/sign-in/"
                className="inline-flex h-11 items-center rounded-md border border-white/30 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Sign in
              </a>
            </div>
          </Show>
          <Show when="signed-in">
            <Link
              to="/dashboard"
              className="inline-flex h-11 items-center rounded-md bg-white px-6 text-sm font-medium text-[#cc785c] transition-colors hover:bg-[#f5f0e8]"
            >
              Go to my dashboard
            </Link>
          </Show>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-[#e6dfd8] bg-[#faf9f5] py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#141413]">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#cc785c] text-xs font-bold text-white">P</span>
            PonkoForm
          </div>
          <p className="text-xs text-[#8e8b82]">
            Built with TanStack Start · Clerk Auth · Neon · Drizzle ORM
          </p>
        </div>
      </footer>
    </div>
  )
}
