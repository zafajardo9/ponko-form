import { Link } from "@tanstack/react-router";
import type { DocMeta } from "../../lib/docs-parser";
import { ArrowLeft, BookOpen } from "lucide-react";
import {
  navigationBackIconClass,
  navigationButtonClass,
} from "../ui/Button";

/**
 * DocSidebar
 *
 * Sidebar navigation for an individual doc page.
 * Shows the table of contents (headings) for the current doc,
 * plus a link back to the docs index.
 */
interface DocSidebarProps {
  currentSlug: string;
  allDocs: DocMeta[];
  headings: { level: number; text: string; id: string }[];
}

export function DocSidebar({
  currentSlug,
  allDocs,
  headings,
}: DocSidebarProps) {
  return (
    <aside className="hidden w-72 flex-none xl:block">
      <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-6 overflow-y-auto pr-2">
        <Link
          to="/docs"
          className={`${navigationButtonClass} self-start`}
        >
          <ArrowLeft size={14} className={navigationBackIconClass} />
          All docs
        </Link>

        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
            On this page
          </p>
          <nav className="mt-3 flex flex-col gap-1.5">
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={`rounded-md py-1 text-sm leading-snug transition-colors hover:bg-[#f5f0e8] hover:text-[#141413] ${
                  h.level === 2
                    ? "px-2 text-[#57544d]"
                    : h.level === 3
                      ? "px-2 pl-5 text-[#8e8b82]"
                      : "px-2 pl-8 text-[#8e8b82]"
                }`}
              >
                {h.text}
              </a>
            ))}
            {headings.length === 0 && (
              <p className="text-xs text-[#8e8b82]">No sections</p>
            )}
          </nav>
        </div>

        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
            <BookOpen size={14} />
            <span>All docs</span>
          </div>
          <nav className="flex flex-col gap-1">
            {allDocs.map((d) => (
              <Link
                key={d.slug}
                to="/docs/$slug"
                params={{ slug: d.slug }}
                className={`truncate rounded-md px-2 py-1.5 text-sm transition-colors ${
                  d.slug === currentSlug
                    ? "bg-[#efe9de] text-[#141413]"
                    : "text-[#6c6a64] hover:bg-[#f5f0e8] hover:text-[#141413]"
                }`}
              >
                {d.title}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
