export interface DocMeta {
  slug: string
  title: string
  description: string
  headings: { level: number; text: string; id: string }[]
}

export interface DocData extends DocMeta {
  content: string
}
