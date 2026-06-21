import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDocs, loadDoc } from "../../lib/server-fns/docs";
import { MarkdownRenderer } from "../../components/docs/MarkdownRenderer";
import { DocSidebar } from "../../components/docs/DocSidebar";
import type { DocMeta, DocData } from "../../lib/docs-parser";
import { ArrowLeft, Copy, Check, BookOpen, ChevronRight, Clock } from "lucide-react";

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
  const sorted = [...(allDocs as DocMeta[])].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const idx = sorted.findIndex((d) => d.slug === slug);
  const prevDoc = idx > 0 ? sorted[idx - 1] : null;
  const nextDoc = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
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

  const readingMinutes = Math.max(3, Math.ceil(docData.content.split(/\s+/).length / 220));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex gap-10">
        <DocSidebar currentSlug={slug} allDocs={sorted} headings={docData.headings} />

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex items-center gap-2 text-sm text-[#8e8b82]">
            <Link to="/docs" className="transition-colors hover:text-[#141413]">
              Docs
            </Link>
            <ChevronRight size={12} />
            <span className="truncate text-[#57544d]">{docData.title}</span>
          </div>

          <header className="mb-8 rounded-lg border border-[#e6dfd8] bg-[#efe9de] p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-[#6c6a64]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#faf9f5] px-3 py-1 text-xs font-medium text-[#cc785c]">
                <BookOpen size={13} />
                Guide
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Clock size={13} />
                {readingMinutes} min read
              </span>
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#141413] sm:text-5xl">
              {docData.title}
            </h1>
            {docData.description && (
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#6c6a64] sm:text-lg">
                {docData.description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleCopyMD}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-xs font-medium text-[#6c6a64] transition-colors hover:bg-white hover:text-[#141413]"
              >
                {copied ? (
                  <Check size={13} className="text-[#2d7a3e]" />
                ) : (
                  <Copy size={13} />
                )}
                {copied ? "Copied" : "Copy markdown"}
              </button>
            </div>
          </header>

          {docData.headings.length > 0 && (
            <details className="mb-6 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 xl:hidden">
              <summary className="cursor-pointer text-sm font-medium text-[#141413]">
                On this page
              </summary>
              <nav className="mt-3 grid gap-2">
                {docData.headings.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className="text-sm text-[#6c6a64] hover:text-[#cc785c]"
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </details>
          )}

          <article className="min-w-0 rounded-lg border border-[#e6dfd8] bg-white px-5 py-7 shadow-sm sm:px-8 lg:px-10">
            <MarkdownRenderer content={docData.content} />
          </article>

          <nav className="mt-8 grid gap-4 border-t border-[#e6dfd8] pt-8 sm:grid-cols-2">
            {prevDoc ? (
              <Link
                to="/docs/$slug"
                params={{ slug: prevDoc.slug }}
                className="group rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 transition-all hover:border-[#cc785c] hover:bg-white hover:shadow-sm"
              >
                <span className="text-xs text-[#8e8b82]">Previous</span>
                <p className="mt-1 truncate text-sm font-medium text-[#141413] transition-colors group-hover:text-[#cc785c]">
                  {prevDoc.title}
                </p>
              </Link>
            ) : (
              <div />
            )}

            {nextDoc ? (
              <Link
                to="/docs/$slug"
                params={{ slug: nextDoc.slug }}
                className="group rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 text-right transition-all hover:border-[#cc785c] hover:bg-white hover:shadow-sm"
              >
                <span className="text-xs text-[#8e8b82]">Next</span>
                <p className="mt-1 truncate text-sm font-medium text-[#141413] transition-colors group-hover:text-[#cc785c]">
                  {nextDoc.title}
                </p>
              </Link>
            ) : (
              <div />
            )}
          </nav>
        </main>
      </div>
    </div>
  );
}
