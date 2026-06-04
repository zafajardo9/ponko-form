import { Link } from '@tanstack/react-router'
import type { DocMeta } from '../../lib/docs-parser'

/**
 * DocCard
 *
 * A blog-style card for the docs index page. Shows the document title,
 * description, and a "Read more" link.
 */
interface DocCardProps {
  doc: DocMeta
}

export function DocCard({ doc }: DocCardProps) {
  return (
    <Link
      to="/docs/$slug"
      params={{ slug: doc.slug }}
      className="group block rounded-xl border border-[#e6dfd8] bg-[#efe9de] p-6 transition-all hover:border-[#cc785c] hover:shadow-sm"
    >
      <h2 className="text-lg font-medium text-[#141413] group-hover:text-[#cc785c] transition-colors">
        {doc.title}
      </h2>
      <p className="mt-2 line-clamp-2 text-sm text-[#6c6a64]">{doc.description}</p>
      <div className="mt-4 flex items-center gap-1 text-sm text-[#cc785c]">
        <span>Read more</span>
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  )
}
