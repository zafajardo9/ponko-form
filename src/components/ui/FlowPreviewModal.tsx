import { useMemo, useRef, useState } from "react";
import { FlowEngine, type StepInput } from "../../lib/flow-engine/FlowEngine";
import type {
  FlowNode,
  FlowEdge,
  FlowVariable,
  GroupedField,
} from "../../lib/flow-engine/types";
import {
  FieldRenderer,
  type FieldConfig,
} from "../form-builder/fields/FieldRenderer";
import { FlowProgressBar } from "../flow-execution/FlowProgressBar";
import { GroupStepView } from "../flow-execution/GroupStepView";
import { Button } from "./Button";

/**
 * FlowPreviewModal
 *
 * End-user preview of a flow — runs the flow engine inside the preview dialog,
 * stepping through each node as a form step, calculator, decision, or payment.
 * Payments are simulated. No server persistence.
 */
interface FlowPreviewModalProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
}

export function FlowPreviewModal({
  nodes,
  edges,
  variables,
}: FlowPreviewModalProps) {
  const engineRef = useRef<FlowEngine | null>(null);
  const [, force] = useState(0);
  const [fieldValue, setFieldValue] = useState<string | string[]>("");
  const [decisionValue, setDecisionValue] = useState<string>("");
  const [fieldError, setFieldError] = useState("");
  const [skipRequired, setSkipRequired] = useState(false);
  // Names of variables whose value changed on the latest step — highlighted in
  // the variables panel so the creator can see what a decision/calculator did.
  const [changed, setChanged] = useState<Set<string>>(new Set());

  const [resetKey, setResetKey] = useState(0);

  useMemo(() => {
    try {
      engineRef.current = new FlowEngine(nodes, edges, variables);
    } catch {
      engineRef.current = null;
    }
    setFieldValue("");
    setDecisionValue("");
    setFieldError("");
    setChanged(new Set());
  }, [nodes, edges, variables, resetKey]);

  const engine = engineRef.current;

  if (!engine) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-[#c64545]">
          This flow has no Start node yet.
        </p>
      </div>
    );
  }

  const step = engine.getCurrentStep();
  const values = engine.getVariableValues();
  const complete = engine.isComplete();
  const config = step.config as Record<string, unknown>;

  function diffChanged(before: Record<string, unknown>, after: Record<string, unknown>) {
    const next = new Set<string>();
    for (const v of variables) {
      if (before[v.name] !== after[v.name]) next.add(v.name);
    }
    return next;
  }

  function next(input?: StepInput) {
    setFieldError("");
    const before = engine!.getVariableValues();
    engine!.advance(input);
    const after = engine!.getVariableValues();
    setChanged(diffChanged(before, after));
    setFieldValue("");
    setDecisionValue("");
    force((n) => n + 1);
  }

  function handleBack() {
    if (engine!.goBack()) {
      setChanged(new Set());
      setFieldValue("");
      setDecisionValue("");
      setFieldError("");
      force((n) => n + 1);
    }
  }

  function renderStep(engine: FlowEngine) {
  // ── Terminal: summary ──
  if (complete && step.nodeType === "summary") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d8f0e0] text-3xl text-[#2f7d52]">
          ✓
        </div>
        <h2 className="text-xl font-medium text-[#141413]">
          {(config.title as string) ?? "All done!"}
        </h2>
        {step.renderedOutput && (
          <p className="text-[#6c6a64]">{step.renderedOutput}</p>
        )}
        <div className="mt-4 flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setResetKey((k) => k + 1)}
          >
            Restart preview
          </Button>
        </div>
      </div>
    );
  }

  // ── Terminal: redirect ──
  if (complete && step.nodeType === "redirect") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-[#6c6a64]">Would redirect to:</p>
        <p className="break-all text-sm font-mono text-[#141413]">
          {step.redirectUrl}
        </p>
        <div className="mt-4 flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setResetKey((k) => k + 1)}
          >
            Restart preview
          </Button>
        </div>
      </div>
    );
  }

  const skipToggle = (
    <div className="border-t border-[#e6dfd8] pt-3 flex items-center justify-center">
      <label className="flex items-center gap-1.5 text-xs text-[#8e8b82] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={skipRequired}
          onChange={(e) => setSkipRequired(e.target.checked)}
          className="accent-[#cc785c]"
        />
        Skip required fields
      </label>
    </div>
  );

  const progress = (
    <FlowProgressBar
      current={engine.getCurrentStepNumber()}
      total={engine.getTotalSteps()}
    />
  );

  // ── Payment (simulated in the builder preview — no real gateway/execution) ──
  if (step.isPayment) {
    const amountVar = config.amountVariable as string | undefined;
    const amount = amountVar
      ? ((values[amountVar] as number | string) ?? 0)
      : 0;
    const currency = (config.currency as string) ?? "USD";
    const formatted =
      typeof amount === "number"
        ? amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : amount;
    return (
      <div className="flex flex-col gap-6">
        {progress}
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          <div>
            <p className="text-sm text-[#6c6a64]">Amount due</p>
            <p className="mt-1 text-4xl font-semibold text-[#141413]">
              {currency} {formatted}
            </p>
          </div>
          <p className="text-xs text-[#8e8b82]">
            Preview only — no real charge is made.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button
              onClick={() =>
                next({
                  paymentResult: { success: true, gatewayPaymentId: "PREVIEW" },
                })
              }
            >
              Simulate successful payment
            </Button>
            <Button
              variant="text-link"
              size="sm"
              onClick={() => next({ paymentResult: { success: false } })}
            >
              Simulate failed payment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form field ──
  if (step.nodeType === "form_field") {
    const field: FieldConfig = {
      id: step.nodeId,
      type: ((config.fieldType as string) ?? "text") as FieldConfig["type"],
      label: (config.label as string) ?? step.label,
      placeholder: config.placeholder as string | undefined,
      required: Boolean(config.required),
      options: config.options as { label: string; value: string }[] | undefined,
    };

    function submit() {
      const empty = Array.isArray(fieldValue)
        ? fieldValue.length === 0
        : String(fieldValue).trim() === "";
      if (field.required && empty && !skipRequired) {
        setFieldError("This field is required.");
        return;
      }
      next({ formValue: fieldValue });
    }

    return (
      <div className="flex flex-col gap-6">
        {progress}
        <FieldRenderer
          field={field}
          value={fieldValue}
          onChange={setFieldValue}
          error={fieldError}
        />
        <div className="flex items-center justify-between">
          {engine.getCurrentStepNumber() > 1 ? (
            <Button variant="text-link" size="sm" onClick={handleBack}>
              ← Back
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={submit}>Continue</Button>
        </div>
        {skipToggle}
      </div>
    );
  }

  // ── Group: several fields on one step ──
  if (step.nodeType === "group") {
    const title = (config.title as string) || step.label;
    const fields = (config.fields as GroupedField[] | undefined) ?? [];
    return (
      <div className="flex flex-col gap-6">
        {progress}
        <GroupStepView
          key={step.nodeId}
          title={title}
          fields={fields}
          canGoBack={engine.getCurrentStepNumber() > 1}
          onBack={handleBack}
          onSubmit={(groupValues) => next({ groupValues })}
        />
        {skipToggle}
      </div>
    );
  }

  // ── Decision ──
  if (step.nodeType === "decision") {
    const branches =
      (config.branches as { value: string; label: string }[] | undefined) ?? [];
    return (
      <div className="flex flex-col gap-6">
        {progress}
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-[#141413]">{step.label}</p>
          {branches.map((b) => (
            <label
              key={b.value}
              className={`flex cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border px-3 py-2.5 transition-colors ${
                decisionValue === b.value
                  ? "border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)]"
                  : "border-[#e6dfd8] hover:bg-[#faf9f5]"
              }`}
            >
              <input
                type="radio"
                name="decision"
                checked={decisionValue === b.value}
                onChange={() => setDecisionValue(b.value)}
                className="h-4 w-4 accent-[var(--ponko-primary,#cc785c)]"
              />
              <span className="text-sm text-[#141413]">{b.label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between">
          {engine.getCurrentStepNumber() > 1 ? (
            <Button variant="text-link" size="sm" onClick={handleBack}>
              ← Back
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={() => next({ decisionValue })}
            disabled={!decisionValue}
          >
            Continue
          </Button>
        </div>
        {skipToggle}
      </div>
    );
  }

  // ── Calculator ──
  if (step.nodeType === "calculator") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        {progress}
        <p className="text-sm text-[#6c6a64]">{step.label}</p>
        <p className="text-lg font-medium text-[#141413]">
          {config.targetVariable as string} = {config.expression as string}
        </p>
        <Button onClick={() => next()}>Continue</Button>
        {skipToggle}
      </div>
    );
  }

  // ── Start or unknown — just advance ──
  return (
    <div className="flex flex-col gap-4 py-8 text-center">
      <p className="text-[#6c6a64]">{step.label}</p>
      <div className="flex justify-center">
        <Button onClick={() => next()}>Begin</Button>
      </div>
      {skipToggle}
    </div>
  );
  }

  return (
    <div className="flex flex-col gap-4">
      {renderStep(engine)}
      <VariablesPanel variables={variables} values={values} changed={changed} />
    </div>
  );
}

/**
 * Live view of the flow's variables as the preview runs. Lets a creator see what
 * each decision pick or calculator actually does — values update every step, and
 * the ones that just changed are highlighted. Builder-only debugging aid.
 */
function VariablesPanel({
  variables,
  values,
  changed,
}: {
  variables: FlowVariable[];
  values: Record<string, unknown>;
  changed: Set<string>;
}) {
  if (variables.length === 0) return null;

  function formatValue(v: FlowVariable): { text: string; unset: boolean } {
    const raw = values[v.name];
    if (raw === null || raw === undefined || raw === "") {
      return { text: "—", unset: true };
    }
    if (v.type === "boolean") return { text: raw ? "yes" : "no", unset: false };
    if (v.type === "money" || v.type === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        return {
          text: n.toLocaleString("en-US", {
            minimumFractionDigits: v.type === "money" ? 2 : 0,
            maximumFractionDigits: v.type === "money" ? 2 : 6,
          }),
          unset: false,
        };
      }
    }
    return { text: String(raw), unset: false };
  }

  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5">
      <p className="mb-1.5 text-xs font-medium text-[#8e8b82]">Variables (preview)</p>
      <dl className="flex flex-col gap-1">
        {variables.map((v) => {
          const { text, unset } = formatValue(v);
          const isChanged = changed.has(v.name);
          return (
            <div
              key={v.name}
              className={`flex items-baseline justify-between gap-3 rounded px-1.5 py-0.5 text-xs ${
                isChanged ? "bg-[#fbeed9]" : ""
              }`}
            >
              <dt className="font-mono text-[#57544d]">{v.name}</dt>
              <dd
                className={`font-mono ${
                  unset ? "text-[#b8b4ab]" : "text-[#141413]"
                } ${isChanged ? "font-semibold" : ""}`}
              >
                {text}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
