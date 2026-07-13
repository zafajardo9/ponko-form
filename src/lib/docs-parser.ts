import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface DocMeta {
  slug: string
  title: string
  description: string
  headings: { level: number; text: string; id: string }[]
}

export interface DocData extends DocMeta {
  content: string
}

const DOCS_DIR = join(process.cwd(), 'docs')

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

/** Convert slug to filename — find the file in docs/ whose stem matches. */
async function resolveSlug(slug: string): Promise<string | null> {
  const files = await readdir(DOCS_DIR)
  const match = files.find((f) => f.endsWith('.md') && f.replace(/\.md$/, '') === slug)
  return match ? join(DOCS_DIR, match) : null
}

/**
 * List all docs with their metadata (no content).
 * Used for the docs index page.
 */
export async function getDocsList(): Promise<DocMeta[]> {
  const files = await readdir(DOCS_DIR)
  const docs: DocMeta[] = []

  for (const file of files) {
    if (!file.endsWith('.md') || file === 'README.md') continue

    const slug = file.replace(/\.md$/, '')
    const fullPath = join(DOCS_DIR, file)
    const md = await readFile(fullPath, 'utf-8')

    docs.push({
      slug,
      title: extractTitle(md),
      description: extractDescription(md),
      headings: extractHeadings(md),
    })
  }

  return docs.sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Get a single doc's complete data (metadata + content).
 * Used for the individual doc page.
 */
export async function getDoc(slug: string): Promise<DocData | null> {
  const fullPath = await resolveSlug(slug)
  if (!fullPath) return null

  const md = await readFile(fullPath, 'utf-8')

  return {
    slug,
    title: extractTitle(md),
    description: extractDescription(md),
    headings: extractHeadings(md),
    content: md,
  }
}
