import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDocs, loadDoc } from "../../lib/server-fns/docs";
import { MarkdownRenderer } from "../../components/docs/MarkdownRenderer";
import type { DocMeta, DocData } from "../../lib/docs-parser";
import { ArrowLeft, Copy, Check, BookOpen, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/docs/$slug")({
  component: DocPage,
});

function DocPage() {
  const { slug } = Route.useParams();
  const [copied, setCopied] = useState(false);

  const { data: allDocs = [] } = useQuery({
    queryKey: ["docs"],
    queryFn: () => listDocs(),
  });

  const {
    data: doc,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["doc", slug],
    queryFn: () => loadDoc({ data: { slug } }),
  });

  const docData = doc as DocData | undefined;

  async function handleCopyMD() {
    if (!docData) return;
    try {
      await navigator.clipboard.writeText(docData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // Find prev/next docs for navigation.
  const sorted = (allDocs as DocMeta[]).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const idx = sorted.findIndex((d) => d.slug === slug);
  const prevDoc = idx > 0 ? sorted[idx - 1] : null;
  const nextDoc = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-6 h-4 w-24 animate-pulse rounded bg-[#e6dfd8]" />
        <div className="mb-6 h-10 w-3/4 animate-pulse rounded-lg bg-[#e6dfd8]" />
        <div className="mb-8 h-5 w-1/2 animate-pulse rounded bg-[#e6dfd8]" />
        <div className="space-y-3">
          {[60, 75, 82, 68, 71, 78, 64, 85].map((w, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-[#efe9de]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !docData) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#fbe4e1]">
          <BookOpen size={24} className="text-[#c64545]" />
        </div>
        <h1 className="text-2xl font-medium text-[#141413]">
          Document not found
        </h1>
        <p className="mt-2 text-[#6c6a64]">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/docs"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-[#cc785c] hover:text-[#a9583e]"
        >
          <ArrowLeft size={14} /> Browse all docs
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-[#8e8b82]">
        <Link to="/docs" className="hover:text-[#141413] transition-colors">
          Docs
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#57544d]">{docData.title}</span>
      </div>

      {/* Title block */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#141413] tracking-tight leading-tight">
          {docData.title}
        </h1>
        {docData.description && (
          <p className="mt-3 text-lg text-[#6c6a64] leading-relaxed">
            {docData.description}
          </p>
        )}

        {/* Meta bar */}
        <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-[#e6dfd8] pb-5">
          <button
            onClick={handleCopyMD}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-1.5 text-xs text-[#6c6a64] hover:bg-[#efe9de] hover:text-[#141413] transition-colors"
          >
            {copied ? (
              <Check size={12} className="text-[#2d7a3e]" />
            ) : (
              <Copy size={12} />
            )}
            {copied ? "Copied!" : "Copy markdown"}
          </button>
        </div>
      </div>

      {/* Content */}
      <article className="min-w-0">
        <MarkdownRenderer content={docData.content} />
      </article>

      {/* Prev / Next navigation */}
      <nav className="mt-16 flex items-center justify-between gap-4 border-t border-[#e6dfd8] pt-8">
        {prevDoc ? (
          <Link
            to="/docs/$slug"
            params={{ slug: prevDoc.slug }}
            className="group flex-1 rounded-xl border border-[#e6dfd8] bg-[#faf9f5] p-4 transition-all hover:border-[#cc785c] hover:shadow-sm"
          >
            <span className="text-xs text-[#8e8b82]">Previous</span>
            <p className="mt-1 text-sm font-medium text-[#141413] group-hover:text-[#cc785c] transition-colors truncate">
              {prevDoc.title}
            </p>
          </Link>
        ) : (
          <div className="flex-1" />
        )}

        {nextDoc ? (
          <Link
            to="/docs/$slug"
            params={{ slug: nextDoc.slug }}
            className="group flex-1 rounded-xl border border-[#e6dfd8] bg-[#faf9f5] p-4 text-right transition-all hover:border-[#cc785c] hover:shadow-sm"
          >
            <span className="text-xs text-[#8e8b82]">Next</span>
            <p className="mt-1 text-sm font-medium text-[#141413] group-hover:text-[#cc785c] transition-colors truncate">
              {nextDoc.title}
            </p>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </nav>
    </div>
  );
}
