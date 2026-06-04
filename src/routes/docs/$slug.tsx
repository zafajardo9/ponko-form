import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDocs, loadDoc } from "../../lib/server-fns/docs";
import { MarkdownRenderer } from "../../components/docs/MarkdownRenderer";
import { DocSidebar } from "../../components/docs/DocSidebar";
import type { DocMeta, DocData } from "../../lib/docs-parser";

export const Route = createFileRoute("/docs/$slug")({
  component: DocPage,
});

function DocPage() {
  const { slug } = Route.useParams();
  const [copyLabel, setCopyLabel] = useState("Copy Markdown");

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

  async function handleCopyMD() {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText((doc as DocData).content);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy Markdown"), 2000);
    } catch {
      setCopyLabel("Failed to copy");
      setTimeout(() => setCopyLabel("Copy Markdown"), 2000);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex gap-8">
          <div className="w-64 flex-none">
            <div className="h-64 animate-pulse rounded-xl bg-[#efe9de]" />
          </div>
          <div className="flex-1">
            <div className="h-96 animate-pulse rounded-xl bg-[#efe9de]" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-2xl font-medium text-[#141413]">
          Document not found
        </h1>
        <p className="mt-2 text-[#6c6a64]">
          The page you're looking for doesn't exist.{" "}
          <Link to="/docs" className="text-[#cc785c] hover:underline">
            Browse all docs
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex gap-8">
        {/* Left sidebar */}
        <DocSidebar
          currentSlug={slug}
          allDocs={allDocs as DocMeta[]}
          headings={(doc as DocData).headings}
        />

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {/* Page header with breadcrumb, title, and copy button */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#8e8b82] mb-2">
                <Link
                  to="/docs"
                  className="hover:text-[#141413] transition-colors"
                >
                  Docs
                </Link>
                <span>/</span>
                <span className="text-[#57544d]">{(doc as DocData).title}</span>
              </div>
              <h1 className="text-2xl font-semibold text-[#141413] leading-tight">
                {(doc as DocData).title}
              </h1>
            </div>
            <button
              onClick={handleCopyMD}
              className="flex flex-none items-center gap-1.5 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-xs text-[#6c6a64] hover:bg-[#efe9de] hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copyLabel}
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-[#8e8b82] mb-8 leading-relaxed">
            {(doc as DocData).description}
          </p>

          {/* Rendered content */}
          <MarkdownRenderer content={(doc as DocData).content} />
        </main>
      </div>
    </div>
  );
}
