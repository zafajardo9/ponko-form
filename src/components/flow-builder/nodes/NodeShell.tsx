import { Handle, Position } from '@xyflow/react'
import type { ReactNode } from 'react'
import { FlowValidationBadge } from '../FlowValidationBadge'

/**
 * NodeShell
 *
 * Shared chrome for every custom flow node: a compact card with a type icon,
 * label, optional detail line, an optional validation badge, and React Flow
 * connection handles. Each node type wraps this with its own icon/accent and
 * handle configuration.
 */
export interface NodeShellProps {
  icon: ReactNode
  /** Tailwind classes for the icon chip (bg + text). */
  accent: string
  label: string
  /** Optional second line — e.g. an expression or template preview. */
  detail?: string
  selected?: boolean
  hasError?: boolean
  errorCount?: number
  errorMessages?: string[]
  /** Whether to render the incoming (top) handle. Terminal-source nodes (start) omit it. */
  hasTarget?: boolean
  /** Whether to render the outgoing (bottom) handle. Terminal nodes (summary/redirect) omit it. */
  hasSource?: boolean
  /** Diamond styling for decision nodes. */
  diamond?: boolean
}

export function NodeShell({
  icon,
  accent,
  label,
  detail,
  selected,
  hasError,
  errorCount,
  errorMessages,
  hasTarget = true,
  hasSource = true,
  diamond = false,
}: NodeShellProps) {
  const truncated = label.length > 24 ? `${label.slice(0, 24)}…` : label

  return (
    <div
      className={`relative min-w-[180px] max-w-[240px] rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-colors ${
        selected ? 'border-[#cc785c] ring-2 ring-[#cc785c]/40' : hasError ? 'border-[#c64545]' : 'border-[#e6dfd8]'
      } ${diamond ? 'rounded-md' : ''}`}
    >
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#8e8b82]"
        />
      )}

      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-md text-sm font-semibold ${accent}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[#141413]">{truncated}</div>
          {detail && <div className="truncate text-xs text-[#8e8b82]">{detail}</div>}
        </div>
      </div>

      {hasError && <FlowValidationBadge count={errorCount ?? 1} messages={errorMessages} />}

      {hasSource && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#cc785c]"
        />
      )}
    </div>
  )
}

/** Shape of the `data` carried by every React Flow node in the builder. */
export interface FlowNodeData {
  label: string
  config: Record<string, unknown>
  hasError?: boolean
  errorCount?: number
  errorMessages?: string[]
  [key: string]: unknown
}
