import type { ReactNode } from 'react'
import type { PageField, PageFieldType } from '../../lib/page-builder/types'
import {
  AlignJustify,
  MapPin,
  AtSign,
  Calendar,
  CalendarClock,
  Calculator,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  FileText,
  Hash,
  Image,
  ShieldCheck,
  Smile,
  Type,
  Upload,
} from 'lucide-react'

export type FieldPaletteItem = {
  type: PageFieldType
  label: string
  description: string
  category: 'Questions' | 'Choices' | 'Date & time' | 'Content' | 'Advanced'
  icon: ReactNode
  preset?: 'terms'
}

export const FIELD_ITEMS: FieldPaletteItem[] = [
  { type: 'text', label: 'Short text', description: 'A single-line written answer.', category: 'Questions', icon: <Type size={14} /> },
  { type: 'email', label: 'Email', description: 'An email address with validation.', category: 'Questions', icon: <AtSign size={14} /> },
  { type: 'number', label: 'Number', description: 'A numeric answer you can calculate with.', category: 'Questions', icon: <Hash size={14} /> },
  { type: 'textarea', label: 'Long text', description: 'A multi-line written answer.', category: 'Questions', icon: <AlignJustify size={14} /> },
  { type: 'address', label: 'Address', description: 'A structured postal address.', category: 'Questions', icon: <MapPin size={14} /> },
  { type: 'file_upload', label: 'File upload', description: 'One or more uploaded files.', category: 'Questions', icon: <Upload size={14} /> },
  { type: 'select', label: 'Dropdown', description: 'Choose one option from a compact menu.', category: 'Choices', icon: <ChevronDown size={14} /> },
  { type: 'checkbox', label: 'Checkboxes', description: 'Choose one or more options.', category: 'Choices', icon: <CheckSquare size={14} /> },
  { type: 'checkbox', label: 'Terms', description: 'A required agreement checkbox.', category: 'Choices', icon: <ShieldCheck size={14} />, preset: 'terms' },
  { type: 'radio', label: 'Single choice', description: 'Choose exactly one visible option.', category: 'Choices', icon: <CircleDot size={14} /> },
  { type: 'satisfaction', label: 'Rating', description: 'Stars, satisfaction, or NPS scale.', category: 'Choices', icon: <Smile size={14} /> },
  { type: 'date', label: 'Date', description: 'A calendar date.', category: 'Date & time', icon: <Calendar size={14} /> },
  { type: 'time', label: 'Time', description: 'A time of day.', category: 'Date & time', icon: <Clock size={14} /> },
  { type: 'datetime', label: 'Date and time', description: 'A calendar date and time.', category: 'Date & time', icon: <CalendarClock size={14} /> },
  { type: 'content', label: 'Instructions', description: 'Formatted text that does not collect an answer.', category: 'Content', icon: <FileText size={14} /> },
  { type: 'media', label: 'Media', description: 'An image, video, or embedded resource.', category: 'Content', icon: <Image size={14} /> },
  { type: 'computation', label: 'Calculated value', description: 'A total or formula built from other answers.', category: 'Advanced', icon: <Calculator size={14} /> },
  { type: 'recaptcha', label: 'Spam protection', description: 'Google reCAPTCHA verification.', category: 'Advanced', icon: <ShieldCheck size={14} /> },
]

export const FIELD_CATEGORIES: FieldPaletteItem['category'][] = [
  'Questions',
  'Choices',
  'Date & time',
  'Content',
  'Advanced',
]

export function fieldPaletteItem(type: PageFieldType) {
  return FIELD_ITEMS.find((item) => item.type === type && !item.preset) ?? FIELD_ITEMS[0]
}

export function isContentField(field: Pick<PageField, 'fieldType'>) {
  return field.fieldType === 'content' || field.fieldType === 'media'
}

export function mediaOption(field: PageField, key: 'type' | 'caption') {
  return field.options?.find((option) => option.label === key)?.value ?? ''
}

export function setMediaOption(field: PageField, key: 'type' | 'caption', value: string) {
  const rest = (field.options ?? []).filter((option) => option.label !== key)
  return [...rest, { label: key, value }]
}

export function fieldOption(field: PageField, key: string) {
  return field.options?.find((option) => option.label === key)?.value ?? ''
}

export function setFieldOption(field: PageField, key: string, value: string) {
  const rest = (field.options ?? []).filter((option) => option.label !== key)
  return [...rest, { label: key, value }]
}

