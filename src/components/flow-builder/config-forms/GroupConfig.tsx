import { Field, TextField, type ConfigFormProps } from './controls'
import { GroupFieldsEditor } from './GroupFieldsEditor'
import type { GroupedField } from '../../../lib/flow-engine/types'

/**
 * Config form for a Group node.
 *
 * A group bundles several fields onto a single step so the end user fills them
 * all out before continuing — instead of one field per "Next". Fields live
 * inline in the node's `config.fields` (they are not separate graph nodes) and
 * are edited through the shared {@link GroupFieldsEditor} container, the same
 * component used inline in the List and Canvas views.
 */
export function GroupConfig({ nodeId, config, variables, onChange }: ConfigFormProps) {
  const fields = (config.fields as GroupedField[] | undefined) ?? []

  return (
    <div className="flex flex-col gap-4">
      <Field label="Group title" hint="Shown as a heading above the fields (optional).">
        <TextField
          resetKey={nodeId}
          value={(config.title as string) ?? ''}
          onCommit={(v) => onChange({ title: v })}
          placeholder="e.g. Your details"
        />
      </Field>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
          Fields ({fields.length})
        </p>
        <GroupFieldsEditor
          fields={fields}
          variables={variables}
          onChange={(next) => onChange({ fields: next })}
        />
      </div>
    </div>
  )
}
