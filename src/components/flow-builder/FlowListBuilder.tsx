import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FlowNode, FlowEdge, FlowNodeType } from '../../lib/flow-engine/types'
import { linearizePrimaryPath, isPureLinear } from '../../lib/flow-engine/path-utils'

/**
 * FlowListBuilder
 *
 * The unified editor's List view — a builder-style, ordered list of flow nodes
 * along the primary path. Mirrors the old FormBuilder list (dnd-kit sortable),
 * but each row is a flow node. Reordering is only enabled for pure-linear flows
 * (no branches); when a flow has decisions, the list shows everything read-only
 * and points the creator to Canvas view for rearranging. Branch-only nodes are
 * grouped under a "Branches" section.
 */

const NODE_META: Record<FlowNodeType, { icon: string; accent: string; label: string }> = {
  start: { icon: '▶', accent: 'bg-[#d8f0e0] text-[#2f7d52]', label: 'Start' },
  form_field: { icon: '☐', accent: 'bg-[#dbe7f7] text-[#2f5a9e]', label: 'Form Field' },
  group: { icon: '⊞', accent: 'bg-[#f3e3da] text-[#a9583e]', label: 'Field Group' },
  decision: { icon: '◇', accent: 'bg-[#f7ecd0] text-[#9e7424]', label: 'Decision' },
  calculator: { icon: '∑', accent: 'bg-[#e7ddf7] text-[#6b46a8]', label: 'Calculator' },
  payment: { icon: '$', accent: 'bg-[#d8f0e0] text-[#2f7d52]', label: 'Payment' },
  summary: { icon: '≡', accent: 'bg-[#ececea] text-[#57544d]', label: 'Summary' },
  redirect: { icon: '↗', accent: 'bg-[#ececea] text-[#57544d]', label: 'Redirect' },
}

const TERMINAL = new Set<FlowNodeType>(['summary', 'redirect'])

/** Short subtitle describing a node's current configuration. */
function nodeDetail(node: FlowNode): string {
  const c = node.config
  switch (node.type) {
    case 'form_field':
      return c.fieldType ? `${c.fieldType}${c.required ? ' · required' : ''}` : 'Not configured'
    case 'group':
      return `${(c.fields as unknown[] | undefined)?.length ?? 0} fields on one step`
    case 'decision':
      return `${(c.branches as unknown[] | undefined)?.length ?? 0} branches`
    case 'calculator':
      return (c.expression as string) || 'No expression'
    case 'payment':
      return c.amountVariable ? `Charge {{${c.amountVariable}}}` : 'No amount set'
    case 'summary':
      return (c.title as string) || 'Summary'
    case 'redirect':
      return (c.urlTemplate as string) || 'No URL'
    default:
      return ''
  }
}

interface FlowListBuilderProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  selectedNodeId: number | null
  byNodeErrors: Map<number, string[]>
  onSelect: (nodeId: number | null) => void
  /** Full new primary-chain order (Start first, terminal last). */
  onReorder: (orderedNodeIds: number[]) => void
  onDelete: (nodeId: number) => void
  onEditBranchesInCanvas: () => void
}

export function FlowListBuilder({
  nodes,
  edges,
  selectedNodeId,
  byNodeErrors,
  onSelect,
  onReorder,
  onDelete,
  onEditBranchesInCanvas,
}: FlowListBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const { ordered, offPath } = linearizePrimaryPath(nodes, edges)
  const canReorder = isPureLinear(nodes, edges)

  const orderedNodes = ordered.map((id) => byId.get(id)!).filter(Boolean)
  const startNode = orderedNodes.find((n) => n.type === 'start') ?? null
  const middle = orderedNodes.filter((n) => n.type !== 'start' && !TERMINAL.has(n.type))
  const terminals = orderedNodes.filter((n) => TERMINAL.has(n.type))
  const offPathNodes = offPath.map((id) => byId.get(id)!).filter(Boolean)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = middle.findIndex((n) => n.id === active.id)
    const newIndex = middle.findIndex((n) => n.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const newMiddle = arrayMove(middle, oldIndex, newIndex)
    const full = [
      ...(startNode ? [startNode.id] : []),
      ...newMiddle.map((n) => n.id),
      ...terminals.map((n) => n.id),
    ]
    onReorder(full)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Start marker */}
      {startNode && (
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[#d8f0e0] text-[10px] text-[#2f7d52]">
            ▶
          </span>
          Start
        </div>
      )}

      {middle.length === 0 && (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-[#e6dfd8] text-center text-sm text-[#8e8b82]">
          Add fields and logic from the left panel to build your form
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={middle.map((n) => n.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {middle.map((node) => (
              <SortableNodeRow
                key={node.id}
                node={node}
                draggable={canReorder && node.type !== 'decision'}
                isSelected={selectedNodeId === node.id}
                errors={byNodeErrors.get(node.id)}
                isBranchSource={node.type === 'decision'}
                onSelect={() => onSelect(selectedNodeId === node.id ? null : node.id)}
                onDelete={() => onDelete(node.id)}
                onEditBranchesInCanvas={onEditBranchesInCanvas}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!canReorder && middle.length > 1 && (
        <p className="px-1 text-xs text-[#8e8b82]">
          This form has branches — reorder steps in{' '}
          <button onClick={onEditBranchesInCanvas} className="text-[#cc785c] underline">
            Canvas view
          </button>
          .
        </p>
      )}

      {/* Terminal node(s) */}
      {terminals.map((node) => (
        <NodeRow
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          errors={byNodeErrors.get(node.id)}
          onSelect={() => onSelect(selectedNodeId === node.id ? null : node.id)}
        />
      ))}

      {/* Off-path / branch-only nodes */}
      {offPathNodes.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[#e6dfd8] pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
              Branches
            </p>
            <button
              onClick={onEditBranchesInCanvas}
              className="text-xs text-[#cc785c] underline hover:text-[#a9583e]"
            >
              Edit in Canvas
            </button>
          </div>
          {offPathNodes.map((node) => (
            <NodeRow
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              errors={byNodeErrors.get(node.id)}
              muted
              onSelect={() => onSelect(selectedNodeId === node.id ? null : node.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface NodeRowProps {
  node: FlowNode
  isSelected: boolean
  errors?: string[]
  muted?: boolean
  isBranchSource?: boolean
  onSelect: () => void
  onDelete?: () => void
  onEditBranchesInCanvas?: () => void
  dragHandle?: React.ReactNode
}

/** Static (non-sortable) row — used for terminal and off-path nodes. */
function NodeRow(props: NodeRowProps) {
  const { node, isSelected, errors, muted, onSelect, onDelete, isBranchSource, onEditBranchesInCanvas, dragHandle } =
    props
  const meta = NODE_META[node.type]
  const hasError = !!errors?.length

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        isSelected
          ? 'border-[#cc785c] ring-2 ring-[#cc785c]/20 bg-[#faf9f5]'
          : hasError
            ? 'border-[#e3b5ab] bg-[#fbf3f0]'
            : 'border-[#e6dfd8] bg-[#faf9f5] hover:border-[#cc785c]/50'
      } ${muted ? 'opacity-80' : ''}`}
    >
      {dragHandle}
      <span
        className={`flex h-7 w-7 flex-none items-center justify-center rounded-md text-xs font-semibold ${meta.accent}`}
      >
        {meta.icon}
      </span>
      <button className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
            {meta.label}
          </span>
          {hasError && <span className="text-xs text-[#c64545]">⚠ {errors!.length}</span>}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-[#141413]">
          {node.label || meta.label}
        </p>
        <p className="truncate text-xs text-[#8e8b82]">{nodeDetail(node)}</p>
      </button>

      {isBranchSource && onEditBranchesInCanvas && (
        <button
          onClick={onEditBranchesInCanvas}
          className="flex-none text-xs text-[#cc785c] underline hover:text-[#a9583e]"
        >
          branches ↳
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="hidden flex-none text-sm text-[#8e8b82] hover:text-[#c64545] group-hover:block"
          aria-label="Delete step"
        >
          ✕
        </button>
      )}
    </div>
  )
}

/** Sortable wrapper around NodeRow for the draggable middle nodes. */
function SortableNodeRow({
  node,
  draggable,
  isSelected,
  errors,
  isBranchSource,
  onSelect,
  onDelete,
  onEditBranchesInCanvas,
}: {
  node: FlowNode
  draggable: boolean
  isSelected: boolean
  errors?: string[]
  isBranchSource: boolean
  onSelect: () => void
  onDelete: () => void
  onEditBranchesInCanvas: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !draggable,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <NodeRow
        node={node}
        isSelected={isSelected}
        errors={errors}
        isBranchSource={isBranchSource}
        onSelect={onSelect}
        onDelete={onDelete}
        onEditBranchesInCanvas={onEditBranchesInCanvas}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className={`flex-none touch-none text-[#8e8b82] ${
              draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-30'
            }`}
            aria-label="Drag to reorder"
            disabled={!draggable}
          >
            ⠿
          </button>
        }
      />
    </div>
  )
}
