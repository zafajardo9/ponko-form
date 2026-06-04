/**
 * FlowValidationBadge
 *
 * A small red badge overlaid on a node that has validation errors. Shows the
 * error count and exposes the messages via the native title tooltip.
 */
export function FlowValidationBadge({ count, messages }: { count: number; messages?: string[] }) {
  if (count <= 0) return null
  return (
    <span
      title={messages?.join('\n') ?? `${count} issue${count > 1 ? 's' : ''}`}
      className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c64545] px-1 text-[11px] font-semibold text-white shadow"
    >
      {count}
    </span>
  )
}
