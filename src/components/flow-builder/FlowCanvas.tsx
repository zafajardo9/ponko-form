import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './nodes'
import { FLOW_DND_MIME } from './FlowPalette'
import type { FlowNodeType } from '../../lib/flow-engine/types'

/**
 * FlowCanvas
 *
 * Wraps React Flow with the project's conventions:
 *   - Snap-to-grid (20px), smoothstep edges
 *   - Custom node types registered via `nodeTypes`
 *   - Minimap (bottom-right) and zoom Controls (bottom-left)
 *   - Delete key removes selected nodes/edges (handled by React Flow + parent
 *     via onNodesChange/onEdgesChange)
 *   - Drag-and-drop from the palette: the parent supplies onDropNode(type, pos)
 *
 * The canvas fills the center column of the 3-column builder layout.
 * React Flow ref: https://reactflow.dev/api-reference/react-flow
 */
interface FlowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onNodeClick: (nodeId: string) => void
  onPaneClick: () => void
  /** Called when a palette item is dropped onto the canvas at a flow position. */
  onDropNode: (type: Exclude<FlowNodeType, 'start'>, position: { x: number; y: number }) => void
  /** Persist positions when a node drag completes. */
  onNodeDragStop?: () => void
  onNodesDelete?: (deleted: Node[]) => void
  onEdgesDelete?: (deleted: Edge[]) => void
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onDropNode,
  onNodeDragStop,
  onNodesDelete,
  onEdgesDelete,
}: FlowCanvasProps) {
  const instanceRef = useRef<ReactFlowInstance | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData(FLOW_DND_MIME) as Exclude<FlowNodeType, 'start'>
      if (!type || !instanceRef.current) return
      const position = instanceRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      onDropNode(type, position)
    },
    [onDropNode],
  )

  return (
    <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => (instanceRef.current = instance)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-[#faf9f5]"
      >
        <Background color="#e6dfd8" gap={20} />
        <Controls className="!shadow-sm" />
        <MiniMap pannable zoomable className="!bg-[#f5f0e8]" />
      </ReactFlow>
    </div>
  )
}
