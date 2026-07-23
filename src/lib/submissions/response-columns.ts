export interface ResponseColumn {
  key: string
  label: string
}

export interface PageColumnSource {
  pageId: number
  fieldId: number | null
  bindVariable: string | null
  label: string | null
}

export interface FlowColumnSource {
  flowId: number
  nodeId: number | null
  type: string | null
  label: string | null
  config: unknown
}

export interface LegacyColumnSource {
  id: number
  label: string
}

export type ResponseColumnSources = {
  pages: PageColumnSource[]
  flows: FlowColumnSource[]
  legacy: LegacyColumnSource[]
}

export function responseColumnsFromSources({
  pages,
  flows,
  legacy,
}: ResponseColumnSources): ResponseColumn[] {
  // Page forms have runtime precedence even when their pages contain no fields.
  if (pages.length > 0) {
    return pages.flatMap((row) =>
      row.fieldId != null && row.bindVariable
        ? [{ key: row.bindVariable, label: row.label || row.bindVariable }]
        : [],
    )
  }

  if (flows.length > 0) {
    const columns: ResponseColumn[] = []
    for (const node of flows) {
      if (node.nodeId == null || !node.type) continue
      const config = node.config && typeof node.config === 'object'
        ? node.config as Record<string, unknown>
        : {}

      if (node.type === 'form_field') {
        const key = typeof config.bindToVariable === 'string'
          ? config.bindToVariable
          : ''
        if (key) {
          columns.push({
            key,
            label: typeof config.label === 'string' && config.label
              ? config.label
              : node.label || key,
          })
        }
      } else if (node.type === 'group' && Array.isArray(config.fields)) {
        for (const item of config.fields) {
          if (!item || typeof item !== 'object') continue
          const field = item as Record<string, unknown>
          const key = typeof field.bindToVariable === 'string'
            ? field.bindToVariable
            : ''
          if (!key) continue
          columns.push({
            key,
            label: typeof field.label === 'string' && field.label
              ? field.label
              : key,
          })
        }
      }
    }
    return columns
  }

  return legacy.map((field) => ({
    key: String(field.id),
    label: field.label,
  }))
}

export function loadResponseColumnSources(
  loaders: {
    pages: () => PromiseLike<PageColumnSource[]>
    flows: () => PromiseLike<FlowColumnSource[]>
    legacy: () => PromiseLike<LegacyColumnSource[]>
  },
) {
  return Promise.all([
    loaders.pages(),
    loaders.flows(),
    loaders.legacy(),
  ] as const).then(([pages, flows, legacy]) => ({ pages, flows, legacy }))
}
