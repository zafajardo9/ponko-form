import { Check, ChevronDown, Copy, FileText, LockKeyhole } from "lucide-react";
import type { WorkflowStep } from "./content";

const fieldClass =
  "rounded-lg border border-hairline bg-canvas px-3 py-2.5 text-xs text-muted-soft";

export function HeroFormMockup() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-[0_20px_60px_rgba(20,20,19,0.10)]"
    >
      <div className="flex items-center gap-1.5 border-b border-hairline bg-surface-soft px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-primary/45" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/45" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/55" />
        <div className="ml-3 flex-1 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-[10px] text-muted-soft">
          ponkoform.app/forms/submit/event-registration
        </div>
      </div>
      <div className="grid gap-5 p-5 sm:p-7">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-surface-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            Step 1 of 2
          </div>
          <h3 className="font-[var(--font-display)] text-2xl text-ink">
            Event registration
          </h3>
          <p className="mt-1 text-xs text-muted">
            Reserve your place and complete payment securely.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={fieldClass}>Full name</div>
          <div className={fieldClass}>Email address</div>
          <div className={`${fieldClass} flex items-center justify-between sm:col-span-2`}>
            General admission
            <ChevronDown size={13} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-surface-dark p-4 text-on-dark">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-on-dark-soft">
              Registration total
            </p>
            <p className="mt-1 text-lg font-medium">PHP 2,450.00</p>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-white">
            Continue <span aria-hidden="true">→</span>
          </div>
        </div>
      </div>
      <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
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
    <div className={`space-y-2 ${compact ? "p-3" : "p-5"}`}>
      <div className="mb-3">
        <div className="h-2 w-16 rounded bg-primary/70" />
        <div className="mt-2 h-3 w-28 rounded bg-ink/75" />
      </div>
      <div className={fieldClass}>Full name</div>
      <div className={fieldClass}>Email address</div>
      {!compact && <div className={fieldClass}>What can we help with?</div>}
      <div className="rounded-md bg-primary px-3 py-2 text-center text-[10px] font-medium text-white">
        Continue
      </div>
    </div>
  );
}

export function ResponsiveFormsMockup() {
  return (
    <div aria-hidden="true" className="relative mx-auto flex max-w-4xl items-end justify-center gap-4 sm:gap-8">
      <div className="w-3/4 overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-sm">
        <div className="flex gap-1 border-b border-hairline bg-surface-soft px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-soft/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-soft/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-soft/40" />
        </div>
        <MiniForm />
      </div>
      <div className="-ml-16 w-32 shrink-0 overflow-hidden rounded-[1.6rem] border-[5px] border-surface-dark bg-canvas shadow-xl sm:-ml-24 sm:w-40">
        <div className="mx-auto mt-1 h-1.5 w-10 rounded-full bg-surface-dark" />
        <MiniForm compact />
      </div>
    </div>
  );
}
