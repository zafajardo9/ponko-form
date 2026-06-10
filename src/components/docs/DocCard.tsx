import { Link } from "@tanstack/react-router";
import type { DocMeta } from "../../lib/docs-parser";
import { ArrowRight, FileText, BookOpen, Zap, BookMarked } from "lucide-react";

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
  "payments-guide": FileText,
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

  return (
    <Link
      to="/docs/$slug"
      params={{ slug: doc.slug }}
      className="group block rounded-xl border border-[#e6dfd8] bg-white p-5 transition-all hover:border-[#cc785c] hover:shadow-sm"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium text-[#141413] group-hover:text-[#cc785c] transition-colors leading-snug">
            {doc.title}
          </h2>
          <p className="mt-1.5 line-clamp-2 text-sm text-[#6c6a64] leading-relaxed">
            {doc.description}
          </p>
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#cc785c]">
            <span>Read more</span>
            <ArrowRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
