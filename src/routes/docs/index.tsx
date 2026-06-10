import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDocs } from "../../lib/server-fns/docs";
import { DocCard } from "../../components/docs/DocCard";
import type { DocMeta } from "../../lib/docs-parser";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
});

function DocsIndexPage() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["docs"],
    queryFn: () => listDocs(),
  });

  const allDocs = docs as DocMeta[];

  // Categorize docs.
  const gettingStarted = allDocs.filter(
    (d) =>
      d.slug === "getting-started" ||
      d.title.toLowerCase().includes("getting started"),
  );
  const guides = allDocs.filter(
    (d) => d.slug.includes("guide") || d.slug === "flow-form-guide",
  );
  const reference = allDocs.filter(
    (d) =>
      d.slug === "flow-builder-guide" ||
      d.slug === "payments-guide" ||
      d.title.toLowerCase().includes("reference"),
  );
  const other = allDocs.filter(
    (d) =>
      !gettingStarted.includes(d) &&
      !guides.includes(d) &&
      !reference.includes(d),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-6 h-12 w-64 animate-pulse rounded-lg bg-[#e6dfd8]" />
        <div className="mb-10 h-5 w-96 animate-pulse rounded bg-[#e6dfd8]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl bg-[#efe9de]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Hero */}
      <div className="mb-14">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8f0e0]">
            <BookOpen size={20} className="text-[#2f7d52]" />
          </div>
          <h1 className="text-3xl font-semibold text-[#141413] tracking-tight">
            Documentation
          </h1>
        </div>
        <p className="text-lg text-[#6c6a64] max-w-2xl">
          Everything you need to build forms with PonkoForm — from quick starts
          and tutorials to complete reference guides.
        </p>
      </div>

      {allDocs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e6dfd8] p-16 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-[#8e8b82]" />
          <p className="text-[#8e8b82]">No documentation yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {/* Getting Started */}
          {gettingStarted.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8e8b82]">
                Getting Started
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gettingStarted.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {/* Guides & Tutorials */}
          {guides.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8e8b82]">
                Guides & Tutorials
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {guides.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {/* Reference */}
          {reference.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8e8b82]">
                Reference
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {reference.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {/* Other */}
          {other.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8e8b82]">
                More
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {other.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* See also link */}
      <div className="mt-14 rounded-xl border border-[#e6dfd8] bg-[#faf9f5] p-6">
        <h3 className="text-sm font-semibold text-[#141413]">
          Need more help?
        </h3>
        <p className="mt-1 text-sm text-[#6c6a64]">
          Check out the{" "}
          <Link to="/dashboard" className="text-[#cc785c] hover:text-[#a9583e]">
            Dashboard
          </Link>{" "}
          to start building forms, or visit the{" "}
          <Link to="/forms/new" className="text-[#cc785c] hover:text-[#a9583e]">
            New Form
          </Link>{" "}
          page to create your first one.
        </p>
      </div>
    </div>
  );
}
