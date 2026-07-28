import { useEffect, useMemo, useRef, useState } from "react";
import {
  Field,
  VariableSelect,
  textAreaClass,
  type ConfigFormProps,
} from "./Controls";
import { ExpressionEvaluator } from "../../../lib/flow-engine/ExpressionEvaluator";
import type {
  FlowVariable,
  FlowVariableType,
} from "../../../lib/flow-engine/types";

const FUNCTIONS = ["round", "sum", "min", "max", "abs"];
const evaluator = new ExpressionEvaluator();

/** Chip colors per variable type — matches the Variables panel badges. */
const VAR_CHIP: Record<FlowVariableType, string> = {
  string: "bg-[#dbe7f7] text-[#2f5a9e]",
  number: "bg-[#e7ddf7] text-[#6b46a8]",
  boolean: "bg-[#f7ecd0] text-[#9e7424]",
  money: "bg-[#d8f0e0] text-[#2f7d52]",
  date: "bg-[#f3e3da] text-[#a9583e]",
  time: "bg-[#f3e3da] text-[#a9583e]",
  datetime: "bg-[#f3e3da] text-[#a9583e]",
};

/** Variable names referenced as {{name}} inside an expression. */
function referencedNames(expr: string): string[] {
  const names = new Set<string>();
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) names.add(m[1].trim());
  return [...names];
}

/** Format a numeric result, with 2-decimal currency formatting for money targets. */
function formatResult(value: number, isMoney: boolean): string {
  if (isMoney) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

/**
 * Config form for a Calculator node. The creator picks a target variable and
 * writes an expression; variables can be inserted at the cursor as type-colored
 * pills, the expression renders a readable preview, and an interactive tester
 * lets them plug in sample respondent values and watch the result compute live
 * — ideal for setting up payment totals.
 */
export function CalculatorConfig({
  nodeId,
  config,
  variables,
  onChange,
}: ConfigFormProps) {
  const [expr, setExpr] = useState((config.expression as string) ?? "");
  const [showTester, setShowTester] = useState(false);
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setExpr((config.expression as string) ?? "");
    setTestValues({});
  }, [nodeId]);

  function commit(next: string) {
    setExpr(next);
    onChange({ expression: next });
  }

  /** Insert a token at the caret. `caretFromEnd` lets functions land the caret inside parens. */
  function insert(token: string, caretFromEnd = 0) {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? expr.length;
    const end = ta?.selectionEnd ?? expr.length;
    const before = expr.slice(0, start);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const piece = (needsSpace ? " " : "") + token;
    const next = before + piece + expr.slice(end);
    commit(next);
    const caret = before.length + piece.length - caretFromEnd;
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(caret, caret);
    });
  }

  const referenced = useMemo(() => referencedNames(expr), [expr]);

  // Seed tester inputs from declared defaults whenever new variables are referenced.
  useEffect(() => {
    setTestValues((prev) => {
      const next = { ...prev };
      for (const name of referenced) {
        if (next[name] === undefined) {
          next[name] =
            variables.find((v) => v.name === name)?.defaultValue ?? "";
        }
      }
      return next;
    });
  }, [referenced, variables]);

  const targetType = variables.find(
    (v) => v.name === config.targetVariable,
  )?.type;
  const isMoneyTarget = targetType === "money";

  // Live test result from the sample values.
  const testResult = useMemo(() => {
    if (!expr.trim()) return null;
    const scope: Record<string, unknown> = {};
    for (const name of referenced) {
      const v = variables.find((x) => x.name === name);
      const raw = testValues[name] ?? "";
      if (v && (v.type === "number" || v.type === "money")) {
        const n = parseFloat(raw);
        scope[name] = Number.isFinite(n) ? n : 0;
      } else if (v && v.type === "boolean") {
        scope[name] = raw === "true";
      } else {
        scope[name] = raw;
      }
    }
    return evaluator.evaluate(expr, { variables: scope });
  }, [expr, referenced, testValues, variables]);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Target variable" hint="The computed result is stored here.">
        <VariableSelect
          value={config.targetVariable as string | undefined}
          variables={variables}
          filterTypes={["number", "money"]}
          onChange={(name) => onChange({ targetVariable: name })}
        />
      </Field>

      <Field
        label="Expression"
        hint="Combine variables, numbers, operators (+ − × ÷) and functions."
      >
        <textarea
          ref={taRef}
          value={expr}
          rows={3}
          onChange={(e) => setExpr(e.target.value)}
          onBlur={() => commit(expr)}
          placeholder="{{subtotal}} * 1.12"
          className={`${textAreaClass} font-mono`}
        />
      </Field>

      {/* Readable preview — variables as chips instead of raw {{ }} */}
      {expr.trim() && (
        <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#8e8b82]">
            Reads as
          </p>
          <ExpressionPreview expr={expr} variables={variables} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[#8e8b82]">Insert variable</p>
        <div className="flex flex-wrap gap-1.5">
          {variables.map((v) => (
            <button
              key={v.id}
              onClick={() => insert(`{{${v.name}}}`)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${VAR_CHIP[v.type]}`}
              title={`${v.name} (${v.type})`}
            >
              {v.name}
            </button>
          ))}
          {variables.length === 0 && (
            <span className="text-xs text-[#8e8b82]">
              No variables declared yet.
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-medium text-[#8e8b82]">Functions</p>
        <div className="flex flex-wrap gap-1.5">
          {FUNCTIONS.map((fn) => (
            <button
              key={fn}
              onClick={() => insert(`${fn}()`, 1)}
              className="rounded-md border border-[#e6dfd8] bg-white px-2 py-1 font-mono text-xs text-[#57544d] hover:border-[#cc785c]"
            >
              {fn}()
            </button>
          ))}
        </div>
      </div>

      {/* Interactive tester */}
      <div className="rounded-lg border border-[#e6dfd8] bg-white">
        <button
          onClick={() => setShowTester((s) => !s)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-sm font-medium text-[#141413]">
            Test calculation
          </span>
          <span className="text-xs text-[#8e8b82]">
            {showTester ? "▲ Hide" : "▼ Show"}
          </span>
        </button>

        {showTester && (
          <div className="flex flex-col gap-3 border-t border-[#e6dfd8] px-3 py-3">
            {referenced.length === 0 ? (
              <p className="text-xs text-[#8e8b82]">
                Add a variable to your expression to test it with sample values.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#8e8b82]">
                  Sample values
                </p>
                {referenced.map((name) => {
                  const v = variables.find((x) => x.name === name);
                  return (
                    <label key={name} className="flex items-center gap-2">
                      <span
                        className={`flex-none rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          v ? VAR_CHIP[v.type] : "bg-[#f3d6d0] text-[#c64545]"
                        }`}
                      >
                        {name}
                      </span>
                      {v?.type === "boolean" ? (
                        <select
                          value={testValues[name] ?? ""}
                          onChange={(e) =>
                            setTestValues((s) => ({
                              ...s,
                              [name]: e.target.value,
                            }))
                          }
                          className="h-9 flex-1 rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-2 text-sm"
                        >
                          <option value="">false</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          value={testValues[name] ?? ""}
                          onChange={(e) =>
                            setTestValues((s) => ({
                              ...s,
                              [name]: e.target.value,
                            }))
                          }
                          type={
                            v?.type === "number" || v?.type === "money"
                              ? "number"
                              : "text"
                          }
                          placeholder={v ? v.type : "undeclared variable"}
                          className="h-9 flex-1 rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-2.5 text-sm text-[#141413] outline-none focus:border-[#cc785c]"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            {/* Result */}
            {testResult && (
              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  testResult.success
                    ? "bg-[#d8f0e0] text-[#2f7d52]"
                    : "bg-[#fbf3f0] text-[#c64545]"
                }`}
              >
                {testResult.success ? (
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-xs">Result</span>
                    <span className="font-semibold">
                      {config.targetVariable
                        ? `${config.targetVariable} = `
                        : ""}
                      {formatResult(testResult.value, isMoneyTarget)}
                    </span>
                  </span>
                ) : (
                  testResult.error
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders an expression with {{variable}} placeholders shown as type-colored
 * chips and the operators lightly prettified (× ÷), so the creator reads it like
 * a formula instead of raw template syntax.
 */
function ExpressionPreview({
  expr,
  variables,
}: {
  expr: string;
  variables: FlowVariable[];
}) {
  const parts: React.ReactNode[] = [];
  const re = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  function pushText(text: string) {
    if (!text) return;
    const pretty = text
      .replace(/\*/g, " × ")
      .replace(/\//g, " ÷ ")
      .replace(/\s+/g, " ");
    parts.push(
      <span key={`t${key++}`} className="text-[#57544d]">
        {pretty}
      </span>,
    );
  }

  while ((m = re.exec(expr))) {
    pushText(expr.slice(last, m.index));
    const name = m[1].trim();
    const v = variables.find((x) => x.name === name);
    parts.push(
      <span
        key={`v${key++}`}
        className={`mx-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
          v ? VAR_CHIP[v.type] : "bg-[#f3d6d0] text-[#c64545]"
        }`}
        title={v ? `${name} (${v.type})` : `${name} — not declared`}
      >
        {name}
      </span>,
    );
    last = re.lastIndex;
  }
  pushText(expr.slice(last));

  return (
    <div className="flex flex-wrap items-center gap-y-1 font-mono text-sm leading-6">
      {parts}
    </div>
  );
}
