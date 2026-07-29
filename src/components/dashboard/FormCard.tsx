import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Check,
  CreditCard,
  Eye,
  FilePenLine,
  MailCheck,
  MoreHorizontal,
  ReceiptText,
  Share2,
  Trash2,
  type LucideProps,
} from "lucide-react";
import { Badge } from "../ui/Badge";

interface FormCardProps {
  form: {
    id: number;
    publicId: string;
    title: string;
    status: "draft" | "published";
    description: string | null;
    updatedAt: Date | string;
    hasPayment: boolean;
  };
  onDelete: (id: number) => void;
  onPreview: (id: number) => void;
  onShare: (id: number) => void;
  selected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
}

const workspaceSections: {
  label: string;
  description: string;
  to:
    | "/forms/$formId/edit"
    | "/forms/$formId/submissions"
    | "/forms/$formId/emails"
    | "/forms/$formId/payments"
    | "/forms/$formId/invoicing";
  icon: ComponentType<LucideProps>;
  paymentOnly?: boolean;
}[] = [
  {
    label: "Builder",
    description: "Edit form",
    to: "/forms/$formId/edit",
    icon: FilePenLine,
  },
  {
    label: "Responses",
    description: "View entries",
    to: "/forms/$formId/submissions",
    icon: BarChart3,
  },
  {
    label: "Response emails",
    description: "Send confirmations",
    to: "/forms/$formId/emails",
    icon: MailCheck,
  },
  {
    label: "Payments",
    description: "Track charges",
    to: "/forms/$formId/payments",
    icon: CreditCard,
    paymentOnly: true,
  },
  {
    label: "Invoicing",
    description: "Manage receipts",
    to: "/forms/$formId/invoicing",
    icon: ReceiptText,
    paymentOnly: true,
  },
];

export function FormCard({
  form,
  onDelete,
  onPreview,
  onShare,
  selected = false,
  onSelectionChange,
}: FormCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const updatedAt = new Date(form.updatedAt);
  const canShare = form.status === "published";

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    const focusFrame = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    });
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <article
      className={`group relative flex h-full flex-col rounded-2xl border bg-[#faf9f5] shadow-[0_1px_2px_rgba(20,20,19,0.04)] transition-[border-color,box-shadow,transform] duration-200 focus-within:z-20 hover:z-10 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(20,20,19,0.08)] motion-reduce:transform-none motion-reduce:transition-none ${
        selected
          ? "border-[#cc785c] shadow-[0_0_0_3px_rgba(204,120,92,0.14)]"
          : "border-[#e2dbd2] hover:border-[#d7cdc2]"
      }`}
    >
      <div className="flex min-h-36 flex-col px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={`Select ${form.title}`}
              onClick={() => onSelectionChange?.(form.id, !selected)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 ${
                selected
                  ? "border-[#cc785c] bg-[#cc785c] text-white shadow-[0_2px_6px_rgba(204,120,92,0.28)]"
                  : "border-[#d7cec5] bg-white text-transparent hover:border-[#bb8b79] hover:bg-[#fff8f4]"
              }`}
            >
              <Check size={15} strokeWidth={3} aria-hidden="true" />
            </button>
            <Badge variant={form.status}>{form.status}</Badge>
          </div>

          <div ref={menuRef} className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={`More actions for ${form.title}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8b82] transition-colors hover:bg-[#efe9de] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                aria-label={`${form.title} actions`}
                className="absolute right-0 top-10 z-30 w-56 rounded-xl border border-[#e6dfd8] bg-white p-1.5 shadow-[0_16px_40px_rgba(20,20,19,0.16)]"
              >
                <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a958d]">
                  Workspace
                </p>
                {workspaceSections
                  .filter((section) => !section.paymentOnly || form.hasPayment)
                  .map((section) => {
                    const Icon = section.icon;
                    return (
                      <Link
                        key={section.label}
                        role="menuitem"
                        to={section.to}
                        params={{ formId: String(form.id) }}
                        aria-label={`${section.label} for ${form.title}`}
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f3eee6] text-[#a9583e]">
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-[#282622]">
                            {section.label}
                          </span>
                          <span className="block text-xs text-[#817d76]">
                            {section.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                <div className="my-1.5 border-t border-[#ece6de]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(form.id);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-[#b33e35] transition-colors hover:bg-[#fdf0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545]"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Delete form
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <Link
          to="/forms/$formId/edit"
          params={{ formId: String(form.id) }}
          className="mt-3.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-4"
        >
          <h2 className="line-clamp-2 text-lg font-semibold leading-6 text-[#141413] transition-colors group-hover:text-[#9f5039]">
            {form.title}
          </h2>
        </Link>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-[#6c6a64]">
          {form.description || "No description added yet."}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-xs text-[#8e8b82]">
            Updated {formatTimeAgo(updatedAt)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={`Preview ${form.title}`}
              onClick={() => onPreview(form.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ddd4ca] bg-white px-3 text-sm font-medium text-[#4f4c46] transition-colors hover:border-[#c8bbb0] hover:bg-[#f5f0e8] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
            >
              <Eye size={15} aria-hidden="true" />
              Preview
            </button>
            <button
              type="button"
              disabled={!canShare}
              title={
                canShare
                  ? `Share ${form.title}`
                  : "Publish this form before sharing it"
              }
              aria-label={
                canShare
                  ? `Share ${form.title}`
                  : `Share ${form.title} — publish first`
              }
              onClick={() => onShare(form.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#cc785c] px-3 text-sm font-medium text-white transition-colors hover:bg-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#ddd5cc] disabled:text-[#807b74]"
            >
              <Share2 size={15} aria-hidden="true" />
              Share
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
