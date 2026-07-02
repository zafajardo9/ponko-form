import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDocs } from "../../lib/server-fns/docs";
import { DocCard } from "../../components/docs/DocCard";
import type { DocMeta } from "../../lib/docs-parser";
import {
  ArrowRight,
  BookOpen,
  Compass,
  CreditCard,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
});

function DocsIndexPage() {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["docs"],
    queryFn: () => listDocs(),
  });

  const allDocs = docs as DocMeta[];

  const gettingStarted = allDocs.filter((d) => d.slug === "getting-started");
  const guides = allDocs.filter((d) => d.slug === "flow-form-guide");
  const reference = allDocs.filter((d) => d.slug === "flow-builder-guide");
  const payments = allDocs.filter((d) => d.slug === "payments-guide");
  const other = allDocs.filter(
    (d) =>
      !gettingStarted.includes(d) &&
      !guides.includes(d) &&
      !reference.includes(d) &&
      !payments.includes(d),
  );
  const featured =
    allDocs.find((d) => d.slug === "getting-started") ?? allDocs[0];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-[#e6dfd8]" />
        <div className="mb-6 h-12 w-72 animate-pulse rounded-lg bg-[#e6dfd8]" />
        <div className="mb-10 h-5 w-2/3 animate-pulse rounded bg-[#e6dfd8]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-lg border border-[#e6dfd8] bg-[#efe9de] p-7 sm:p-8">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-[#cc785c]">
            <BookOpen size={16} />
            <span>PonkoForm Docs</span>
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-[#141413] sm:text-5xl">
            Build flows that feel like guided service journeys.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#6c6a64] sm:text-lg">
            Learn how to ask questions, remember answers, branch the path,
            calculate totals, collect payments, and finish with the right
            receipt or redirect.
          </p>
          {featured && (
            <Link
              to="/docs/$slug"
              params={{ slug: featured.slug }}
              className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#cc785c] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]"
            >
              Start reading
              <ArrowRight size={16} />
            </Link>
          )}
        </section>

        <aside className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8e8b82]">
            Best path
          </p>
          <div className="mt-5 space-y-4">
            {[
              {
                icon: Sparkles,
                label: "Start",
                text: "Create your first flow form.",
              },
              {
                icon: Compass,
                label: "Shape",
                text: "Add branches and calculations.",
              },
              {
                icon: CreditCard,
                label: "Collect",
                text: "Connect payments and receipts.",
              },
            ].map((item) => (
              <div key={item.label} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f5f0e8] text-[#cc785c]">
                  <item.icon size={17} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#141413]">
                    {item.label}
                  </p>
                  <p className="text-sm leading-relaxed text-[#6c6a64]">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {allDocs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e6dfd8] p-16 text-center">
          <BookOpen size={32} className="mx-auto mb-3 text-[#8e8b82]" />
          <p className="text-[#8e8b82]">No documentation yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {gettingStarted.length > 0 && (
            <section>
              <SectionHeader
                title="Start Here"
                description="The shortest path from blank form to working flow."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {gettingStarted.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {guides.length > 0 && (
            <section>
              <SectionHeader
                title="Guides & Tutorials"
                description="Practical walkthroughs for real form journeys."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {guides.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {reference.length > 0 && (
            <section>
              <SectionHeader
                title="Builder Reference"
                description="Node types, variables, validation, and runtime behavior."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reference.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {payments.length > 0 && (
            <section>
              <SectionHeader
                title="Payments"
                description="Gateway setup, checkout behavior, and transaction tracking."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {payments.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}

          {other.length > 0 && (
            <section>
              <SectionHeader
                title="More"
                description="Additional product notes and implementation context."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {other.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-12 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-6">
        <h3 className="text-sm font-semibold text-[#141413]">
          Ready to build?
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-[#6c6a64]">
          Check out the{" "}
          <Link to="/forms" className="text-[#cc785c] hover:text-[#a9583e]">
            Forms
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

interface SectionHeaderProps {
  title: string;
  description: string;
}

function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#141413]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[#6c6a64]">{description}</p>
      </div>
    </div>
  );
}
