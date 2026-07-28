import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  CreditCard,
  FileText,
  GitBranch,
  LockKeyhole,
  MailCheck,
  Monitor,
  Smartphone,
  Zap,
} from "lucide-react";
import type { WorkflowStep } from "./content";

const fieldClass =
  "rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-xs text-muted-soft";

export function HeroFormMockup() {
  const [activeView, setActiveView] = useState<"form" | "logic" | "payment">("form");
  const views = [
    { id: "form", label: "Form", icon: FileText },
    { id: "logic", label: "Logic", icon: GitBranch },
    { id: "payment", label: "Payment", icon: CreditCard },
  ] as const;

  return (
    <div className="hero-mockup group relative mx-auto w-full max-w-2xl pb-12 pl-2 pt-5 sm:pb-14 sm:pl-8 sm:pt-8">
      <div aria-hidden="true" className="hero-float-badge absolute -right-1 top-0 z-20 hidden items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-2 text-[11px] font-medium text-ink shadow-[0_12px_35px_rgba(20,20,19,0.12)] sm:flex">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
          <CircleCheck size={12} aria-hidden="true" />
        </span>
        Payment connected
      </div>
      <div aria-hidden="true" className="hero-float-badge hero-float-badge-email absolute -right-1 bottom-1 z-20 hidden items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-2 text-[11px] font-medium text-ink shadow-[0_12px_35px_rgba(20,20,19,0.12)] sm:flex">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
          <MailCheck size={12} />
        </span>
        Email delivery ready
      </div>
      <div aria-hidden="true" className="hero-float-badge hero-float-badge-automation absolute -left-2 bottom-24 z-20 hidden items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-2 text-[11px] font-medium text-ink shadow-[0_12px_35px_rgba(20,20,19,0.12)] lg:flex">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Zap size={12} />
        </span>
        Automation triggered
      </div>
      <div className="absolute inset-x-10 bottom-3 top-14 -z-10 rotate-3 rounded-[1.75rem] bg-primary/12 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[4.5deg] group-hover:scale-[1.01]" aria-hidden="true" />
      <div className="absolute inset-x-5 bottom-7 top-8 -z-10 -rotate-2 rounded-[1.75rem] border border-hairline bg-surface-card transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-3" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[0_28px_80px_rgba(20,20,19,0.15)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:shadow-[0_36px_90px_rgba(20,20,19,0.19)]">
        <div className="flex items-center gap-1.5 border-b border-hairline bg-surface-soft px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/45" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/45" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/55" />
          <div className="ml-2 min-w-0 flex-1 truncate rounded-md border border-hairline bg-canvas px-3 py-1.5 text-[10px] text-muted-soft sm:ml-3">
            ponkoform.app/event-registration
          </div>
          <span className="hidden items-center gap-1 text-[9px] font-medium text-success sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live
          </span>
        </div>
        <div className="grid min-h-[29rem] sm:grid-cols-[7.5rem_1fr]">
          <div className="border-b border-hairline bg-surface-soft/70 p-2 sm:border-b-0 sm:border-r sm:p-3">
            <p className="hidden px-2 pb-2 pt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-soft sm:block">
              Journey
            </p>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-1">
              {views.map(({ id, label, icon: Icon }) => {
                const selected = activeView === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveView(id)}
                    className={`flex min-h-9 items-center justify-center gap-2 rounded-lg px-2 py-2 text-[11px] font-medium transition-[transform,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:justify-start ${
                      selected
                        ? "bg-canvas text-primary shadow-sm"
                        : "text-muted hover:translate-x-0.5 hover:bg-canvas/70 hover:text-ink"
                    }`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-5 hidden rounded-lg border border-dashed border-primary/25 p-2.5 sm:block">
              <p className="text-[9px] leading-4 text-muted">
                One response stays connected through every step.
              </p>
            </div>
          </div>
          <div className="relative p-5 sm:p-7">
            <div key={activeView} className="hero-panel-enter">
              {activeView === "form" && (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 inline-flex rounded-full bg-surface-card px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.16em] text-primary">
                        Step 1 of 2
                      </div>
                      <h3 className="font-[var(--font-display)] text-3xl leading-none text-ink">
                        Event registration
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        Reserve your place and complete payment securely.
                      </p>
                    </div>
                    <span className="hidden rounded-full border border-hairline px-2 py-1 text-[9px] text-muted sm:block">
                      Preview
                    </span>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className={`${fieldClass} transition-colors hover:border-primary/35 hover:text-ink`}>Full name</div>
                    <div className={`${fieldClass} transition-colors hover:border-primary/35 hover:text-ink`}>Email address</div>
                    <div className={`${fieldClass} flex items-center justify-between transition-colors hover:border-primary/35 hover:text-ink sm:col-span-2`}>
                      General admission
                      <ChevronDown size={13} />
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-dark p-4 text-on-dark">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.14em] text-on-dark-soft">
                        Registration total
                      </p>
                      <p className="mt-1 text-lg font-medium">PHP 2,450.00</p>
                    </div>
                    <button type="button" className="group/continue flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-white transition-transform active:scale-95">
                      Continue
                      <ArrowRight className="transition-transform group-hover/continue:translate-x-1" size={13} />
                    </button>
                  </div>
                </div>
              )}
              {activeView === "logic" && (
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-primary">Conditional path</p>
                  <h3 className="mt-2 font-[var(--font-display)] text-3xl leading-none text-ink">Route the right experience</h3>
                  <p className="mt-2 text-xs leading-5 text-muted">Rules adapt the next step without breaking the response trail.</p>
                  <div className="mt-7 space-y-3">
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-ink">
                        <GitBranch size={14} className="text-primary" />
                        If ticket is “General admission”
                      </div>
                    </div>
                    <div className="ml-6 h-5 w-px bg-primary/30" aria-hidden="true" />
                    <div className="ml-4 rounded-xl border border-hairline bg-surface-soft p-4">
                      <p className="text-[9px] uppercase tracking-[0.14em] text-muted-soft">Then</p>
                      <p className="mt-1 text-xs font-medium text-ink">Continue to secure payment</p>
                    </div>
                    <div className="ml-6 h-5 w-px bg-primary/30" aria-hidden="true" />
                    <div className="ml-8 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-[11px] font-medium text-success">
                      <CircleCheck size={13} />
                      Response context carried forward
                    </div>
                  </div>
                </div>
              )}
              {activeView === "payment" && (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-primary">Payment status</p>
                      <h3 className="mt-2 font-[var(--font-display)] text-3xl leading-none text-ink">Paid and reconciled</h3>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1.5 text-[10px] font-medium text-success">
                      <CircleCheck size={12} />
                      Completed
                    </span>
                  </div>
                  <div className="mt-7 rounded-xl border border-hairline bg-surface-soft p-4">
                    <div className="flex items-start justify-between gap-3 border-b border-hairline pb-4">
                      <div>
                        <p className="text-[10px] text-muted-soft">Event registration</p>
                        <p className="mt-1 text-sm font-medium text-ink">Jamie Rivera</p>
                      </div>
                      <p className="text-sm font-semibold text-ink">PHP 2,450.00</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-4 text-center">
                      {["Created", "Pending", "Paid"].map((status, index) => (
                        <div key={status}>
                          <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold ${
                            index === 2 ? "bg-success text-white" : "bg-primary/15 text-primary"
                          }`}>
                            {index === 2 ? <Check size={11} /> : index + 1}
                          </span>
                          <p className={`mt-2 text-[9px] ${index === 2 ? "font-medium text-success" : "text-muted"}`}>{status}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-[10px] leading-4 text-muted">
                    <LockKeyhole size={13} className="shrink-0 text-success" />
                    Verified by webhook and linked to this response.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkflowMockup({ type }: { type: WorkflowStep["mockup"] }) {
  if (type === "templates") {
    return (
      <div className="grid h-28 grid-cols-2 gap-2 p-3" aria-hidden="true">
        {["Contact", "Support", "Deal", "Blank"].map((label, index) => (
          <div
            key={label}
            className={`rounded-md border p-2 text-[9px] ${index === 0 ? "border-primary bg-primary/10 text-primary" : "border-hairline bg-canvas text-muted"}`}
          >
            <FileText size={12} className="mb-2" />
            {label}
          </div>
        ))}
      </div>
    );
  }

  if (type === "builder") {
    return (
      <div className="grid h-28 grid-cols-[48px_1fr_56px] gap-2 p-3" aria-hidden="true">
        <div className="space-y-1.5 rounded bg-surface-card p-1.5">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-3 rounded bg-canvas" />
          ))}
        </div>
        <div className="space-y-2 rounded border border-hairline bg-canvas p-2">
          <div className="h-2 w-1/2 rounded bg-ink/70" />
          <div className="h-5 rounded border border-primary bg-primary/5" />
          <div className="h-5 rounded border border-hairline" />
        </div>
        <div className="space-y-2 rounded bg-surface-soft p-1.5">
          <div className="h-2 rounded bg-muted-soft/40" />
          <div className="h-4 rounded bg-canvas" />
          <div className="h-2 w-2/3 rounded bg-muted-soft/30" />
        </div>
      </div>
    );
  }

  if (type === "share") {
    return (
      <div className="flex h-28 items-center justify-center p-3" aria-hidden="true">
        <div className="w-full rounded-lg border border-hairline bg-canvas p-3 shadow-sm">
          <p className="text-[10px] font-medium text-ink">Your form is published</p>
          <div className="mt-2 flex items-center gap-2 rounded bg-surface-soft px-2 py-1.5 text-[8px] text-muted">
            ponkoform.app/forms/submit/...
            <Copy size={10} className="ml-auto text-primary" />
          </div>
          <div className="mt-2 flex gap-1">
            <span className="rounded bg-primary px-2 py-1 text-[8px] text-white">Copy link</span>
            <span className="rounded border border-hairline px-2 py-1 text-[8px] text-muted">Embed</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-28 p-3" aria-hidden="true">
      <div className="overflow-hidden rounded-lg border border-hairline bg-canvas">
        <div className="grid grid-cols-[1fr_56px] border-b border-hairline bg-surface-soft px-2 py-1.5 text-[8px] text-muted">
          <span>Response</span>
          <span>Payment</span>
        </div>
        {["Contact inquiry", "Event registration", "Task request"].map((label, index) => (
          <div key={label} className="grid grid-cols-[1fr_56px] border-b border-hairline px-2 py-1.5 text-[8px] text-ink last:border-0">
            <span>{label}</span>
            <span className={index === 2 ? "text-warning" : "text-success"}>
              {index === 2 ? "Pending" : "Paid"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const paymentRows = [
  { id: "Payment #1042", amount: "PHP 2,450", status: "Completed", tone: "success" },
  { id: "Payment #1041", amount: "PHP 1,200", status: "Pending", tone: "warning" },
  { id: "Payment #1040", amount: "PHP 850", status: "Refunded", tone: "primary" },
] as const;

export function PaymentTrackerMockup() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-surface-dark-elevated bg-surface-dark-soft"
    >
      <div className="flex items-center justify-between border-b border-surface-dark-elevated px-5 py-4">
        <div>
          <p className="text-sm font-medium text-on-dark">Payment activity</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.13em] text-on-dark-soft">
            Illustrative dashboard
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-surface-dark-elevated px-2.5 py-1.5 text-[10px] text-on-dark-soft">
          <LockKeyhole size={11} /> Verified events
        </div>
      </div>
      <div className="divide-y divide-surface-dark-elevated px-5">
        {paymentRows.map((payment) => (
          <div key={payment.id} className="grid grid-cols-[1fr_auto] gap-4 py-4">
            <div>
              <p className="text-xs font-medium text-on-dark">{payment.id}</p>
              <p className="mt-1 text-[10px] text-on-dark-soft">{payment.amount}</p>
            </div>
            <span
              className={`self-center rounded-full px-2.5 py-1 text-[10px] font-medium ${
                payment.tone === "success"
                  ? "bg-success/15 text-success"
                  : payment.tone === "warning"
                    ? "bg-warning/15 text-warning"
                    : "bg-primary/15 text-primary"
              }`}
            >
              {payment.status}
            </span>
          </div>
        ))}
      </div>
      <div className="m-5 rounded-xl bg-surface-dark-elevated p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-on-dark-soft">
          Event history
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-on-dark">
          <span className="rounded bg-surface-dark-soft px-2 py-1.5">created</span>
          <span className="text-on-dark-soft">→</span>
          <span className="rounded bg-surface-dark-soft px-2 py-1.5">pending</span>
          <span className="text-on-dark-soft">→</span>
          <span className="flex items-center gap-1 rounded bg-success/15 px-2 py-1.5 text-success">
            <Check size={10} /> completed
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniForm({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "p-3.5" : "p-5 sm:p-6"}>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/12 px-2 py-1 text-[8px] font-medium uppercase tracking-[0.13em] text-primary">
          Step 2 of 3
        </span>
        <span className="text-[8px] text-muted-soft">67% complete</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-card">
        <div className="h-full w-2/3 rounded-full bg-primary" />
      </div>
      <div className={compact ? "mt-4" : "mt-5"}>
        <h3 className={`font-[var(--font-display)] leading-none text-ink ${compact ? "text-lg" : "text-2xl"}`}>
          Tell us about your project
        </h3>
        <p className={`mt-1.5 leading-4 text-muted ${compact ? "text-[8px]" : "text-[10px]"}`}>
          A few details help us prepare the right next step.
        </p>
      </div>
      <div className={`grid ${compact ? "mt-4 gap-2.5" : "mt-5 gap-3 sm:grid-cols-2"}`}>
        <label className="block">
          <span className="mb-1.5 block text-[8px] font-medium text-ink">Project type</span>
          <span className="flex items-center justify-between rounded-lg border border-hairline bg-canvas px-3 py-2 text-[9px] text-muted">
            Website redesign <ChevronDown size={10} />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[8px] font-medium text-ink">Target launch</span>
          <span className="block rounded-lg border border-hairline bg-canvas px-3 py-2 text-[9px] text-muted">
            October 2026
          </span>
        </label>
        {!compact && (
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[8px] font-medium text-ink">What should the new experience improve?</span>
            <span className="block min-h-12 rounded-lg border border-primary/35 bg-primary/5 px-3 py-2 text-[9px] text-muted">
              Make it easier for customers to find and compare our services.
            </span>
          </label>
        )}
      </div>
      <div className={`flex items-center justify-between border-t border-hairline ${compact ? "mt-4 pt-3" : "mt-5 pt-4"}`}>
        <span className="text-[9px] font-medium text-muted">Back</span>
        <span className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[9px] font-medium text-white shadow-[0_5px_16px_rgba(169,88,62,0.18)]">
          Continue <ArrowRight size={10} />
        </span>
      </div>
    </div>
  );
}

export function ResponsiveFormsMockup() {
  const [activeDevice, setActiveDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-ink">Published form preview</p>
          <p className="mt-1 text-[10px] text-muted">Switch viewports to compare the experience.</p>
        </div>
        <div className="inline-grid grid-cols-2 rounded-lg border border-hairline bg-canvas p-1" role="group" aria-label="Preview device">
          {([
            ["desktop", "Desktop", Monitor],
            ["mobile", "Mobile", Smartphone],
          ] as const).map(([id, label, Icon]) => {
            const selected = activeDevice === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveDevice(id)}
                className={`flex min-h-9 items-center justify-center gap-2 rounded-md px-3 text-[11px] font-medium transition-[transform,background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected ? "bg-surface-dark text-on-dark shadow-sm" : "text-muted hover:bg-surface-soft hover:text-ink"
                }`}
              >
                <Icon size={13} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden="true" className="device-preview-stage relative isolate min-h-[31rem] p-1 sm:p-3">
        <div
          className={`absolute left-1 right-1 top-3 overflow-hidden rounded-xl border border-hairline bg-canvas shadow-[0_22px_55px_rgba(20,20,19,0.14)] transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:left-3 sm:right-16 ${
            activeDevice === "desktop"
              ? "translate-x-0 scale-100 opacity-100"
              : "-translate-x-3 scale-[0.96] opacity-55 blur-[0.3px]"
          }`}
        >
          <div className="flex items-center gap-1.5 border-b border-hairline bg-surface-soft px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/45" />
            <span className="h-1.5 w-1.5 rounded-full bg-warning/45" />
            <span className="h-1.5 w-1.5 rounded-full bg-success/55" />
            <div className="ml-2 flex-1 rounded bg-canvas px-2 py-1 text-center text-[7px] text-muted-soft">
              ponkoform.app/project-kickoff
            </div>
          </div>
          <MiniForm />
        </div>
        <div
          className={`absolute bottom-3 right-1 w-[10.5rem] overflow-hidden rounded-[1.65rem] border-[5px] border-[#0f0f0e] bg-canvas shadow-[0_24px_55px_rgba(20,20,19,0.28)] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:bottom-5 sm:right-3 sm:w-[11.5rem] ${
            activeDevice === "mobile"
              ? "-translate-y-2 scale-[1.06] opacity-100"
              : "translate-y-0 scale-100 opacity-90"
          }`}
        >
          <div className="relative h-5 bg-[#0f0f0e]">
            <span className="absolute left-1/2 top-1 h-1.5 w-10 -translate-x-1/2 rounded-full bg-[#353532]" />
          </div>
          <MiniForm compact />
          <div className="mx-auto mb-1.5 h-1 w-14 rounded-full bg-[#0f0f0e]/80" />
        </div>
        <div className="absolute bottom-5 left-3 hidden max-w-[12rem] rounded-lg border border-hairline bg-canvas/95 p-3 text-[9px] leading-4 text-muted shadow-sm backdrop-blur-sm sm:block">
          <span className="mb-1 block font-medium text-ink">Same form, adapted live</span>
          Fields reflow while content and progress stay in sync.
        </div>
      </div>
    </div>
  );
}
