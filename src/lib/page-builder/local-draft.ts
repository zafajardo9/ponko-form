const PREFIX = 'ponko:page-draft:'

export interface PageDraft {
  currentPageIndex: number
  collectedData: Record<string, unknown>
}

/**
 * Strip file-upload data URLs (and any nested `dataUrl` key) before persisting
 * to localStorage. Base64 file payloads can exceed the ~5MB localStorage quota
 * and are not reliably restorable anyway — on resume the respondent re-selects
 * the file.
 */
function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripValue)
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(object)) {
      if (key === 'dataUrl') continue
      out[key] = stripValue(item)
    }
    return out
  }
  return value
}

function storageKey(formId: number): string {
  return `${PREFIX}${formId}`
}

export function loadPageDraft(formId: number): PageDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(formId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PageDraft>
    if (
      typeof parsed.currentPageIndex !== 'number' ||
      !parsed.collectedData ||
      typeof parsed.collectedData !== 'object'
    ) {
      return null
    }
    return {
      currentPageIndex: parsed.currentPageIndex,
      collectedData: parsed.collectedData as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

export function savePageDraft(formId: number, draft: PageDraft): void {
  try {
    const safe = {
      currentPageIndex: draft.currentPageIndex,
      collectedData: stripValue(draft.collectedData),
    }
    window.localStorage.setItem(storageKey(formId), JSON.stringify(safe))
  } catch {
    // localStorage may be unavailable or full — the backend session still
    // persists the response on submit.
  }
}

export function clearPageDraft(formId: number): void {
  try {
    window.localStorage.removeItem(storageKey(formId))
  } catch {
    // ignore
  }
}
