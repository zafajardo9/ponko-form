import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDocs } from "../../lib/server-fns/docs";
import { DocCard } from "../../components/docs/DocCard";
import type { DocMeta } from "../../lib/docs-parser";

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
});

function DocsIndexPage() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["docs"],
    queryFn: () => listDocs(),
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      {/* Hero */}
      <div className="mb-12">
        <h1 className="text-3xl font-medium text-[#141413]">
          Welcome to the Docs
        </h1>
        <p className="mt-2 text-lg text-[#6c6a64]">
          Everything you need to build, manage, and extend forms with PonkoForm.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl bg-[#efe9de]"
            />
          ))}
        </div>
      ) : (docs as DocMeta[]).length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e6dfd8] p-12 text-center">
          <p className="text-[#8e8b82]">No documentation yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* All docs as blog-style cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(docs as DocMeta[]).map((doc) => (
              <DocCard key={doc.slug} doc={doc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
