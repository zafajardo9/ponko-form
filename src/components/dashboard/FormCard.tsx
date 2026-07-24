import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CreditCard,
  Eye,
  FilePenLine,
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
  };
  onDelete: (id: number) => void;
  onShare: (id: number) => void;
}

const workspaceSections: {
  label: string;
  description: string;
  to:
    | "/forms/$formId/edit"
    | "/forms/$formId/submissions"
    | "/forms/$formId/payments"
    | "/forms/$formId/invoicing";
  icon: ComponentType<LucideProps>;
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
    label: "Payments",
    description: "Track charges",
    to: "/forms/$formId/payments",
    icon: CreditCard,
  },
  {
    label: "Invoicing",
    description: "Manage receipts",
    to: "/forms/$formId/invoicing",
    icon: ReceiptText,
  },
];

export function FormCard({ form, onDelete, onShare }: FormCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#e2dbd2] bg-[#faf9f5] shadow-[0_1px_2px_rgba(20,20,19,0.04)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#d7cdc2] hover:shadow-[0_12px_30px_rgba(20,20,19,0.08)] motion-reduce:transform-none motion-reduce:transition-none">
      <div className="flex min-h-36 flex-col px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <Badge variant={form.status}>{form.status}</Badge>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label={`More actions for ${form.title}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8b82] transition-colors hover:bg-[#efe9de] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-[#e6dfd8] bg-white p-1.5 shadow-[0_12px_32px_rgba(20,20,19,0.14)]">
                <button
                  type="button"
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
          className="mt-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-4"
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
            <Link
              to="/forms/$formId/edit"
              params={{ formId: String(form.id) }}
              search={{ preview: true }}
              aria-label={`Preview ${form.title}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ddd4ca] bg-white px-3 text-sm font-medium text-[#4f4c46] transition-colors hover:border-[#c8bbb0] hover:bg-[#f5f0e8] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
            >
              <Eye size={15} aria-hidden="true" />
              Preview
            </Link>
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

      <nav
        aria-label={`${form.title} workspace`}
        className="grid grid-cols-2 border-t border-[#e6dfd8] bg-[#f3eee6]"
      >
        {workspaceSections.map((section, index) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.label}
              to={section.to}
              params={{ formId: String(form.id) }}
              aria-label={`${section.label} for ${form.title}`}
              className={`flex min-w-0 items-center gap-2.5 px-4 py-3 transition-colors hover:bg-[#ebe4da] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c] ${
                index % 2 === 0 ? "border-r border-[#e2dbd2]" : ""
              } ${index < 2 ? "border-b border-[#e2dbd2]" : ""}`}
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white text-[#b45f45] shadow-[0_1px_2px_rgba(20,20,19,0.06)]">
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[#282622]">
                  {section.label}
                </span>
                <span className="block truncate text-[11px] leading-4 text-[#817d76]">
                  {section.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
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
