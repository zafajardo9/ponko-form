import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import type {
  FlowEdge,
  FlowNode,
  FlowNodeType,
  FlowVariable,
} from "../../lib/flow-engine/types";
import type { FlowNodeData } from "./nodes/NodeShell";
import { FlowCanvas } from "./FlowCanvas";

const FLOW_LABELS: Record<FlowNodeType, string> = {
  start: "Start",
  form_field: "Form Field",
  group: "Field Group",
  decision: "Decision",
  calculator: "Calculator",
  payment: "Payment",
  summary: "Summary",
  redirect: "Redirect",
};

export type FlowCanvasLayout = {
  id: number;
  positionX: number;
  positionY: number;
};

export interface FlowCanvasWorkspaceHandle {
  saveNow: () => void;
  autoLayout: () => void;
}

export function buildAutoLayout(
  nodes: Pick<FlowNode, "id" | "type">[],
  edges: Pick<FlowEdge, "sourceNodeId" | "targetNodeId">[],
): FlowCanvasLayout[] {
  const start = nodes.find((node) => node.type === "start");
  if (!start) return [];

  const outgoing = new Map<number, number[]>();
  for (const edge of edges) {
    outgoing.set(edge.sourceNodeId, [
      ...(outgoing.get(edge.sourceNodeId) ?? []),
      edge.targetNodeId,
    ]);
  }

  const level = new Map<number, number>([[start.id, 0]]);
  const queue: number[] = [start.id];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const currentLevel = level.get(id)!;
    for (const targetId of outgoing.get(id) ?? []) {
      if (!level.has(targetId)) {
        level.set(targetId, currentLevel + 1);
        queue.push(targetId);
      }
    }
  }

  const nodesByLevel = new Map<number, number[]>();
  for (const node of nodes) {
    const nodeLevel = level.get(node.id) ?? 0;
    nodesByLevel.set(nodeLevel, [
      ...(nodesByLevel.get(nodeLevel) ?? []),
      node.id,
    ]);
  }

  const layout: FlowCanvasLayout[] = [];
  for (const [nodeLevel, ids] of nodesByLevel) {
    ids.forEach((id, index) => {
      layout.push({
        id,
        positionX: 120 + index * 280,
        positionY: 60 + nodeLevel * 150,
      });
    });
  }
  return layout;
}

interface FlowCanvasWorkspaceProps {
  flow: {
    nodes: FlowNode[];
    edges: FlowEdge[];
    variables: FlowVariable[];
  };
  errorsByNode: Map<number, string[]>;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodeConfig: (
    nodeId: number,
    config: Record<string, unknown>,
  ) => void;
  onAddNode: (
    type: Exclude<FlowNodeType, "start">,
    position: { x: number; y: number },
  ) => void;
  onAddEdge: (sourceNodeId: number, targetNodeId: number) => void;
  onDeleteNode: (nodeId: number) => void;
  onDeleteEdge: (edgeId: number) => void;
  onSaveLayout: (layout: FlowCanvasLayout[]) => void;
}

/**
 * Owns every React Flow dependency and piece of canvas-only state. The unified
 * editor loads this module only after a user switches to Canvas, keeping the
 * default page-builder and list-builder paths free of React Flow's runtime.
 */
export const FlowCanvasWorkspace = forwardRef<
  FlowCanvasWorkspaceHandle,
  FlowCanvasWorkspaceProps
>(function FlowCanvasWorkspace(
  {
    flow,
    errorsByNode,
    onSelectNode,
    onUpdateNodeConfig,
    onAddNode,
    onAddEdge,
    onDeleteNode,
    onDeleteEdge,
    onSaveLayout,
  },
  ref,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const updateConfigRef = useRef(onUpdateNodeConfig);
  updateConfigRef.current = onUpdateNodeConfig;

  useEffect(() => {
    setNodes(
      flow.nodes.map((node) => {
        const messages = errorsByNode.get(node.id);
        return {
          id: String(node.id),
          type: node.type,
          position: { x: node.positionX, y: node.positionY },
          data: {
            label: node.label ?? FLOW_LABELS[node.type],
            config: node.config,
            hasError: Boolean(messages),
            errorCount: messages?.length,
            errorMessages: messages,
            variables: flow.variables,
            onUpdateConfig: (config: Record<string, unknown>) =>
              updateConfigRef.current(node.id, config),
          } as FlowNodeData,
        };
      }),
    );
    setEdges(
      flow.edges.map((edge) => ({
        id: String(edge.id),
        source: String(edge.sourceNodeId),
        target: String(edge.targetNodeId),
        label: edge.metadata?.matchValue,
        type: "smoothstep",
      })),
    );
  }, [
    errorsByNode,
    flow.edges,
    flow.nodes,
    flow.variables,
    setEdges,
    setNodes,
  ]);

  const saveNow = useCallback(() => {
    onSaveLayout(
      nodes.map((node) => ({
        id: Number(node.id),
        positionX: node.position.x,
        positionY: node.position.y,
      })),
    );
  }, [nodes, onSaveLayout]);

  const autoLayout = useCallback(() => {
    const layout = buildAutoLayout(flow.nodes, flow.edges);
    if (layout.length === 0) return;

    const positionById = new Map(layout.map((item) => [item.id, item]));
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const position = positionById.get(Number(node.id));
        return position
          ? {
              ...node,
              position: {
                x: position.positionX,
                y: position.positionY,
              },
            }
          : node;
      }),
    );
    onSaveLayout(layout);
  }, [flow.edges, flow.nodes, onSaveLayout, setNodes]);

  useImperativeHandle(ref, () => ({ autoLayout, saveNow }), [
    autoLayout,
    saveNow,
  ]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge({ ...connection, type: "smoothstep" }, currentEdges),
      );
      if (connection.source && connection.target) {
        onAddEdge(Number(connection.source), Number(connection.target));
      }
    },
    [onAddEdge, setEdges],
  );

  return (
    <FlowCanvas
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onNodeClick={(nodeId) => onSelectNode(nodeId)}
      onPaneClick={() => onSelectNode(null)}
      onDropNode={onAddNode}
      onNodeDragStop={saveNow}
      onNodesDelete={(deleted) => {
        for (const node of deleted) {
          if (node.type !== "start") onDeleteNode(Number(node.id));
        }
      }}
      onEdgesDelete={(deleted) => {
        for (const edge of deleted) onDeleteEdge(Number(edge.id));
      }}
    />
  );
});
