import type { PageFieldOption, PageFieldType } from '../page-builder/types'

export interface TemplateFieldData {
  fieldType: PageFieldType
  label: string
  placeholder?: string | null
  required: boolean
  options?: PageFieldOption[] | null
  bindVariable: string
  position: number
  width?: 'full' | 'half'
}

export interface TemplatePageData {
  title: string
  description?: string | null
  position: number
  isFinal: boolean
  finalTemplate?: string | null
  fields: TemplateFieldData[]
}

export type FormTemplateCategory = 'contact' | 'support' | 'sales' | 'survey' | 'general' | 'custom'

export interface FormTemplateRecord {
  id: number
  profileId: number | null
  name: string
  description: string | null
  category: string
  pagesData: TemplatePageData[]
  isBuiltin: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}
