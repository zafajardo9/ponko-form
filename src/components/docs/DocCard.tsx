import { Link } from "@tanstack/react-router";
import type { DocMeta } from "../../lib/docs-parser";
import { FileText, BookOpen, Zap, BookMarked, CreditCard } from "lucide-react";

/**
 * DocCard
 *
 * A card for the docs index page. Shows the document title, description,
 * and a visual category indicator.
 */
interface DocCardProps {
  doc: DocMeta;
}

const slugIcon: Record<string, typeof FileText> = {
  "getting-started": Zap,
  "flow-form-guide": BookOpen,
  "flow-builder-guide": BookMarked,
  "payments-guide": CreditCard,
};

const slugMeta: Record<string, { label: string; time: string }> = {
  "getting-started": { label: "Start here", time: "10 min" },
  "flow-form-guide": { label: "Tutorial", time: "20 min" },
  "flow-builder-guide": { label: "Reference", time: "15 min" },
  "payments-guide": { label: "Payments", time: "8 min" },
};

export function DocCard({ doc }: DocCardProps) {
  const Icon = slugIcon[doc.slug] ?? FileText;

  // Pick an accent color based on the slug for visual variety.
  const accent =
    doc.slug === "getting-started"
      ? "bg-[#d8f0e0] text-[#2f7d52]"
      : doc.slug === "flow-form-guide"
        ? "bg-[#fef0d8] text-[#8a6000]"
        : doc.slug === "flow-builder-guide"
          ? "bg-[#e1d8f0] text-[#5b3a8a]"
          : doc.slug === "payments-guide"
            ? "bg-[#d8edf0] text-[#2a6b7a]"
            : "bg-[#f5f0e8] text-[#6c6a64]";

  const meta = slugMeta[doc.slug] ?? { label: "Guide", time: "5 min" };

  return (
    <Link
      to="/docs/$slug"
      params={{ slug: doc.slug }}
      className="group flex min-h-[188px] flex-col rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-5 transition-all hover:-translate-y-0.5 hover:border-[#cc785c] hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${accent}`}>
          <Icon size={18} />
        </div>
        <span className="rounded-full border border-[#e6dfd8] px-2.5 py-1 text-[11px] font-medium text-[#8e8b82]">
          {meta.label}
        </span>
      </div>

      <div className="mt-5 min-w-0 flex-1">
        <h2 className="text-lg font-medium leading-snug text-[#141413] transition-colors group-hover:text-[#cc785c]">
          {doc.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#6c6a64]">
          {doc.description}
        </p>
      </div>

      <div className="mt-5 border-t border-[#e6dfd8] pt-4">
        <span className="text-xs text-[#8e8b82]">{meta.time} read</span>
      </div>
    </Link>
  );
}
