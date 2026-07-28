import { useEffect, useState } from "react";
import {
  Field,
  TextField,
  textAreaClass,
  type ConfigFormProps,
} from "./Controls";
import { TemplateInterpolator } from '../../../lib/flow-engine/TemplateInterpolator'
import type { FlowVariableType } from '../../../lib/flow-engine/types'

const interpolator = new TemplateInterpolator();

/** Config form for a Summary node: title + template with a live preview. */
export function SummaryConfig({
  nodeId,
  config,
  variables,
  onChange,
}: ConfigFormProps) {
  const [template, setTemplate] = useState((config.template as string) ?? "");

  useEffect(() => setTemplate((config.template as string) ?? ""), [nodeId]);

  function commit(next: string) {
    setTemplate(next);
    onChange({ template: next });
  }

  // Build a preview scope from variable defaults (or the variable name as a stand-in).
  const previewVars: Record<string, unknown> = {};
  const types: Record<string, FlowVariableType> = {};
  for (const v of variables) {
    types[v.name] = v.type;
    previewVars[v.name] =
      v.defaultValue !== null
        ? v.type === "number" || v.type === "money"
          ? Number(v.defaultValue)
          : v.defaultValue
        : `‹${v.name}›`;
  }
  const preview = interpolator.interpolate(template, {
    variables: previewVars,
    types,
  });

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        <TextField
          resetKey={nodeId}
          value={(config.title as string) ?? ""}
          onCommit={(v) => onChange({ title: v })}
          placeholder="Order Confirmation"
        />
      </Field>

      <Field
        label="Template"
        hint="Use {{variable}} placeholders. Money values format as 1,200.00. Add your own currency symbol in the text (e.g. ₱{{total_cost}})."
      >
        <textarea
          value={template}
          rows={4}
          onChange={(e) => setTemplate(e.target.value)}
          onBlur={() => commit(template)}
          placeholder="Thank you {{name}}! Your total is {{total_cost}}."
          className={textAreaClass}
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <button
            key={v.id}
            onClick={() =>
              commit(template ? `${template} {{${v.name}}}` : `{{${v.name}}}`)
            }
            className="rounded-md border border-[#e6dfd8] bg-white px-2 py-1 text-xs text-[#57544d] hover:border-[#cc785c]"
          >
            {v.name}
          </button>
        ))}
      </div>

      {template && (
        <Field label="Preview">
          <div className="rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 text-sm text-[#141413]">
            {preview}
          </div>
        </Field>
      )}
    </div>
  );
}
