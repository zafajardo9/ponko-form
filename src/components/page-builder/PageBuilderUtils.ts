import type { PageFieldOption } from '../../lib/page-builder/types'

export function tempId() {
  return -Math.floor(Date.now() + Math.random() * 100000)
}

export function slugForBinding(input: string, used: Set<string>) {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'field'
  let candidate = base
  let i = 2
  while (used.has(candidate)) {
    candidate = `${base}_${i}`
    i += 1
  }
  return candidate
}

export function slugForOptionValue(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'option'
}

export function variableToken(name: string) {
  return `{{${name}}}`
}

export function optionValueForLabel(label: string, options: PageFieldOption[], index: number) {
  const base = slugForOptionValue(label) || `option_${index + 1}`
  const used = new Set(options.map((option, optionIndex) => (optionIndex === index ? '' : option.value)))
  let value = base
  let suffix = 2
  while (used.has(value)) {
    value = `${base}_${suffix}`
    suffix += 1
  }
  return value
}

