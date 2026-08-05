import type { FieldConfig } from '../../../lib/form-field-types'
import { FieldRenderer } from './FieldRenderer'

interface FieldPreviewProps {
  field: FieldConfig
  className?: string
}

/**
 * A faithful, non-interactive preview of a field rendered through the exact
 * same renderers respondents see. The label is hidden (the caller renders its
 * own heading) and the whole subtree is marked `inert`, so previews can never
 * be focused, clicked, or announced — they are purely visual.
 *
 * This is what keeps the form builder and the live form in lockstep: any
 * styling change to a field renderer shows up in the builder automatically.
 */
export function FieldPreview({ field, className }: FieldPreviewProps) {
  return (
    <div inert aria-hidden="true" className={className} data-field-preview="">
      <FieldRenderer field={field} value="" onChange={() => {}} hideLabel />
    </div>
  )
}
