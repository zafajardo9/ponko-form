import { Link } from '@tanstack/react-router'
import type { DocMeta } from '../../lib/docs-parser'

/**
 * DocSidebar
 *
 * Sidebar navigation for an individual doc page.
 * Shows the table of contents (headings) for the current doc,
 * plus a link back to the docs index.
 */
interface DocSidebarProps {
  currentSlug: string
  allDocs: DocMeta[]
  headings: { level: number; text: string; id: string }[]
}

export function DocSidebar({ currentSlug, allDocs, headings }: DocSidebarProps) {
  return (
    <aside className="w-64 flex-none">
      <div className="sticky top-24 flex flex-col gap-6">
        {/* Back to all docs */}
        <Link
          to="/docs"
          className="flex items-center gap-1.5 text-sm text-[#8e8b82] hover:text-[#141413] transition-colors"
        >
          ← All docs
        </Link>

        {/* Current doc title */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">On this page</p>
          <nav className="mt-2 flex flex-col gap-1">
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={`text-sm transition-colors hover:text-[#141413] ${
                  h.level === 2
                    ? 'pl-0 text-[#57544d]'
                    : h.level === 3
                      ? 'pl-3 text-[#8e8b82]'
                      : 'pl-6 text-[#8e8b82]'
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

        {/* Other docs */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">All docs</p>
          <nav className="mt-2 flex flex-col gap-1">
            {allDocs
              .filter((d) => d.slug !== currentSlug)
              .slice(0, 8)
              .map((d) => (
                <Link
                  key={d.slug}
                  to="/docs/$slug"
                  params={{ slug: d.slug }}
                  className="truncate text-sm text-[#6c6a64] hover:text-[#141413] transition-colors"
                >
                  {d.title}
                </Link>
              ))}
          </nav>
        </div>
      </div>
    </aside>
  )
}
