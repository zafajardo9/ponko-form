// Docs are imported at build time via Vite's import.meta.glob.
// This eliminates the need for runtime filesystem access and works
// on all deployment targets (Vercel, Node, etc.).
import type { DocMeta, DocData } from './docs-parser-types'

// Re-export types for consumers
export type { DocMeta, DocData } from './docs-parser-types'

// Import all markdown files from the docs/ directory at build time.
const docModules = import.meta.glob<string>('/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Extract the first H1 from markdown content and return it as the title. */
function extractTitle(md: string): string {
  const match = md.match(/^#\s+(.+)$/m)
  if (match) return match[1].trim()
  return 'Untitled'
}

/** Extract the first paragraph after the H1 to use as a description. */
function extractDescription(md: string): string {
  // A short opening quote is the most intentional summary for article-style
  // Markdown, so prefer it over the first body paragraph when one is present.
  const openingQuote = md.match(/^>\s+(.+)$/m)
  if (openingQuote) {
    const quote = openingQuote[1].replace(/[*_`]/g, '').trim()
    if (quote) return quote.slice(0, 200)
  }

  // Get content after the first H1 and before the next heading
  const afterH1 = md.replace(/^#\s+.+$/m, '').trim()
  // Find the first paragraph (non-empty, non-heading line)
  const lines = afterH1.split('\n')
  let desc = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && !trimmed.startsWith('>')) {
      desc = trimmed.replace(/[*_`]/g, '').slice(0, 200)
      break
    }
  }
  return desc || 'Documentation for PonkoForm.'
}

/** Extract all headings for the sidebar table of contents. */
function extractHeadings(md: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = []
  const regex = /^(#{2,4})\s+(.+)$/gm
  let match
  while ((match = regex.exec(md)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    headings.push({ level, text, id })
  }
  return headings
}

/** Convert a file path like '/docs/flow-builder-guide.md' to a slug like 'flow-builder-guide' */
function pathToSlug(path: string): string {
  const filename = path.split('/').pop() ?? ''
  return filename.replace(/\.md$/, '')
}

/**
 * List all docs with their metadata (no content).
 * Used for the docs index page.
 */
export function getDocsList(): DocMeta[] {
  const docs: DocMeta[] = []

  for (const [path, content] of Object.entries(docModules)) {
    const slug = pathToSlug(path)
    // Skip README — it's the docs index, not a content doc
    if (slug === 'README') continue

    docs.push({
      slug,
      title: extractTitle(content),
      description: extractDescription(content),
      headings: extractHeadings(content),
    })
  }

  return docs.sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Get a single doc's complete data (metadata + content).
 * Used for the individual doc page.
 */
export function getDoc(slug: string): DocData | null {
  for (const [path, content] of Object.entries(docModules)) {
    if (pathToSlug(path) === slug) {
      return {
        slug,
        title: extractTitle(content),
        description: extractDescription(content),
        headings: extractHeadings(content),
        content,
      }
    }
  }
  return null
}
