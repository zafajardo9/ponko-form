import { Show } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, RefreshCw } from "lucide-react";
import {
  FEATURE_GROUPS,
  INTEGRATIONS,
  PAYMENT_ASSURANCES,
  TRUST_ITEMS,
  WORKFLOW_STEPS,
} from "./content";
import {
  HeroFormMockup,
  PaymentTrackerMockup,
  ResponsiveFormsMockup,
  WorkflowMockup,
} from "./ProductMockups";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
const primaryButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-active ${focusRing}`;
const secondaryButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-hairline bg-canvas px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-soft ${focusRing}`;

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  centered?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p
        className="text-xs font-medium uppercase tracking-[0.18em] text-primary"
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-4 font-[var(--font-display)] text-4xl font-normal leading-[1.08] tracking-[-0.02em] sm:text-5xl ${dark ? "text-on-dark" : "text-ink"}`}
      >
        {title}
      </h2>
      <p className={`mt-5 text-base leading-7 ${dark ? "text-on-dark-soft" : "text-muted"}`}>
        {description}
      </p>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="overflow-hidden bg-canvas">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-16 sm:py-24 lg:grid-cols-2 lg:py-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-3.5 py-1.5 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Five form templates, ready to use
          </div>
          <h1 className="mt-7 max-w-xl font-[var(--font-display)] text-5xl font-normal leading-[1.02] tracking-[-0.025em] text-ink sm:text-6xl lg:text-[4.5rem]">
            Build forms that keep every response—and payment—connected.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Create responsive, multi-page forms without code. Add conditional fields,
            collect payments, and manage the results from one clear workspace.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Show when="signed-out">
              <a href="/sign-up/" className={primaryButton}>
                Start building free <ArrowRight size={16} />
              </a>
              <a href="#how-it-works" className={secondaryButton}>
                See how it works
              </a>
            </Show>
            <Show when="signed-in">
              <Link to="/forms" className={primaryButton}>
                Go to my forms <ArrowRight size={16} />
              </Link>
              <Link to="/forms/new" className={secondaryButton}>
                Browse templates
              </Link>
            </Show>
          </div>
          <p className="mt-4 text-sm text-muted-soft">No credit card required to get started.</p>
        </div>
        <HeroFormMockup />
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <section aria-label="Product highlights" className="border-y border-hairline bg-surface-soft">
      <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-hairline px-6 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {TRUST_ITEMS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-3 px-3 py-6 sm:px-5">
            <Icon className="mt-0.5 shrink-0 text-primary" size={19} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-medium text-ink">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Build · Collect · Manage"
          title="The complete form workflow, without the clutter"
          description="PonkoForm keeps creation, collection, and follow-up in one coherent system so important context never gets separated from a response."
          centered
        />
        <div className="mt-16 space-y-12">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-5 flex items-center gap-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-soft">
                  {group.label}
                </p>
                <div className="h-px flex-1 bg-hairline" />
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {group.features.map(({ icon: Icon, title, description }) => (
                  <article key={title} className="rounded-xl bg-surface-card p-7">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas text-primary">
                      <Icon size={19} aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-base font-medium text-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-surface-card py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From a blank page to useful answers"
          description="Start with a template, make it yours, and publish when the experience feels right. PonkoForm keeps the operational work just as straightforward."
          centered
        />
        <ol className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STEPS.map(({ number, icon: Icon, title, description, mockup }, index) => (
            <li key={number} className="relative flex flex-col rounded-xl border border-hairline bg-canvas">
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className="absolute -right-5 top-8 z-10 hidden h-px w-5 bg-primary/40 lg:block" />
              )}
              <div className="flex-1 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium tracking-[0.14em] text-primary">{number}</span>
                  <Icon size={17} className="text-muted-soft" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-medium text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
              </div>
              <div className="border-t border-hairline bg-surface-soft">
                <WorkflowMockup type={mockup} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PaymentReliabilitySection() {
  const statuses = [
    ["Completed", "bg-success/15 text-success"],
    ["Pending", "bg-warning/15 text-warning"],
    ["Failed", "bg-error/15 text-error"],
    ["Refunded", "bg-primary/15 text-primary"],
  ] as const;

  return (
    <section className="bg-surface-dark py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Payment reliability"
            title="Every transaction has a state, a history, and a way forward"
            description="PonkoForm records payment status alongside the form journey. Gateway returns, verified webhooks, and reconciliation checks help you distinguish completed payments from transactions that still need attention."
            dark
          />
          <div className="mt-7 flex flex-wrap gap-2">
            {statuses.map(([label, className]) => (
              <span key={label} className={`rounded-full px-3 py-1.5 text-xs font-medium ${className}`}>
                {label}
              </span>
            ))}
          </div>
          <ul className="mt-8 grid gap-3">
            {PAYMENT_ASSURANCES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-on-dark">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-dark-elevated text-primary">
                  <Icon size={14} aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-surface-dark-elevated bg-surface-dark-soft p-4">
            <RefreshCw className="mt-0.5 shrink-0 text-primary" size={17} aria-hidden="true" />
            <p className="text-sm leading-6 text-on-dark-soft">
              Pending or expired checkout? Verify it manually, reuse an active link, or create a replacement without losing the associated response.
            </p>
          </div>
        </div>
        <PaymentTrackerMockup />
      </div>
    </section>
  );
}

function IntegrationsSection() {
  return (
    <section className="bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="Connected workflows"
            title="Use the accounts you already trust"
            description="Connect your own gateway credentials. PonkoForm handles the form-side workflow while the provider remains the source of truth for the transaction."
          />
          <Show when="signed-in">
            <Link to="/settings/integrations" className={`${secondaryButton} shrink-0`}>
              Manage integrations <ArrowRight size={15} />
            </Link>
          </Show>
          <Show when="signed-out">
            <a href="/sign-up/" className={`${secondaryButton} shrink-0`}>
              Connect your stack <ArrowRight size={15} />
            </a>
          </Show>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {INTEGRATIONS.map((integration) => (
            <article key={integration.name} className="rounded-xl border border-hairline bg-canvas p-6">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg text-base font-semibold text-white"
                style={{ backgroundColor: integration.accent }}
                aria-hidden="true"
              >
                {integration.monogram}
              </div>
              <h3 className="mt-5 text-base font-medium text-ink">{integration.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{integration.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RespondentExperienceSection() {
  return (
    <section className="overflow-hidden bg-surface-card py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHeading
            eyebrow="Respondent experience"
            title="A form that fits the screen in front of it"
            description="The same published form adapts across phones and desktop browsers. Page progress, fields, and payment steps stay clear without a separate mobile layout."
          />
          <ul className="mt-7 space-y-3 text-sm text-muted">
            {["Responsive page layouts", "Clear progress between steps", "Focused, accessible form controls"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check size={12} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
        <ResponsiveFormsMockup />
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="bg-primary py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-[var(--font-display)] text-4xl font-normal leading-tight tracking-[-0.02em] text-white sm:text-5xl">
          Build your first useful form today
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/80">
          Start from a template or a blank page, preview the full journey, and publish when you are ready.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Show when="signed-out">
            <a href="/sign-up/" className={`${secondaryButton} border-transparent`}>
              Create a free account <ArrowRight size={16} />
            </a>
            <a
              href="/sign-in/"
              className={`inline-flex min-h-11 items-center justify-center rounded-md border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 ${focusRing} focus-visible:ring-white`}
            >
              Sign in
            </a>
          </Show>
          <Show when="signed-in">
            <Link to="/forms/new" className={`${secondaryButton} border-transparent`}>
              Create a new form <ArrowRight size={16} />
            </Link>
            <Link
              to="/forms"
              className={`inline-flex min-h-11 items-center justify-center rounded-md border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 ${focusRing} focus-visible:ring-white`}
            >
              Go to my forms
            </Link>
          </Show>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-surface-dark py-14 text-on-dark-soft">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 border-b border-surface-dark-elevated pb-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link to="/" className={`inline-flex items-center gap-2 text-on-dark ${focusRing} focus-visible:ring-offset-surface-dark`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
                P
              </span>
              <span className="font-medium">PonkoForm</span>
            </Link>
            <p className="mt-4 text-sm leading-6">
              Responsive forms, connected payments, and an organized response workspace.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-on-dark">Product</h2>
            <nav aria-label="Product" className="mt-4 flex flex-col items-start gap-3 text-sm">
              <Show when="signed-in">
                <Link to="/forms" className={`hover:text-on-dark ${focusRing}`}>Forms</Link>
                <Link to="/forms/new" className={`hover:text-on-dark ${focusRing}`}>Templates</Link>
                <Link to="/settings/integrations" className={`hover:text-on-dark ${focusRing}`}>Integrations</Link>
              </Show>
              <Show when="signed-out">
                <a href="/sign-up/" className={`hover:text-on-dark ${focusRing}`}>Create forms</a>
                <a href="/sign-up/" className={`hover:text-on-dark ${focusRing}`}>Use templates</a>
                <a href="/sign-up/" className={`hover:text-on-dark ${focusRing}`}>Connect integrations</a>
              </Show>
            </nav>
          </div>
          <div>
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-on-dark">Resources</h2>
            <nav aria-label="Resources" className="mt-4 flex flex-col items-start gap-3 text-sm">
              <Link to="/docs" className={`hover:text-on-dark ${focusRing}`}>Documentation</Link>
            </nav>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-7 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PonkoForm. All rights reserved.</p>
          <p>Built for clear, reliable collection.</p>
        </div>
      </div>
    </footer>
  );
}

export function HomePage() {
  return (
    <>
      <main className="min-h-screen bg-canvas">
        <HeroSection />
        <TrustBar />
        <FeaturesSection />
        <WorkflowSection />
        <PaymentReliabilitySection />
        <IntegrationsSection />
        <RespondentExperienceSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
