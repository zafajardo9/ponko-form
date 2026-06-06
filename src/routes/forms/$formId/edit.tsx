import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import { requireAuth } from "../../../lib/server-fns/auth";
import { getForms, updateForm } from "../../../lib/server-fns/forms";
import { getFlow, ensureFlow } from "../../../lib/server-fns/flows";
import {
  addFlowNode,
  updateFlowNode,
  addFlowEdge,
  deleteFlowNode,
  deleteFlowEdge,
  saveFlowLayout,
  insertNodeInPath,
  removeNodeFromPath,
  reorderPath,
  moveFieldIntoGroup,
} from "../../../lib/server-fns/flow-nodes";
import {
  createFlowVariable,
  updateFlowVariable,
  deleteFlowVariable,
} from "../../../lib/server-fns/flow-variables";
import { getActiveGateways } from "../../../lib/server-fns/gateways";
import { FlowCanvas } from "../../../components/flow-builder/FlowCanvas";
import { BuilderPalette } from "../../../components/flow-builder/BuilderPalette";
import { FlowListBuilder } from "../../../components/flow-builder/FlowListBuilder";
import { NodeConfigPanel } from "../../../components/flow-builder/NodeConfigPanel";
import { VariablesManager } from "../../../components/flow-builder/VariablesManager";
import { FlowToolbar } from "../../../components/flow-builder/FlowToolbar";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { PreviewDialog } from "../../../components/ui/PreviewDialog";
import { FlowPreviewModal } from "../../../components/ui/FlowPreviewModal";
import { ShareDialog } from "../../../components/dashboard/ShareDialog";
import { FlowValidator } from "../../../lib/flow-engine/FlowValidator";
import {
  linearizePrimaryPath,
  primaryOutgoingEdge,
} from "../../../lib/flow-engine/path-utils";
import type {
  FlowNode,
  FlowEdge,
  FlowVariable,
  FlowNodeType,
  FlowVariableType,
  FlowValidationError,
  GroupedField,
} from "../../../lib/flow-engine/types";
import type { FlowNodeData } from "../../../components/flow-builder/nodes/NodeShell";

export const Route = createFileRoute("/forms/$formId/edit")({
  beforeLoad: () => requireAuth(),
  component: UnifiedEditorPage,
});

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

const TERMINAL_TYPES = new Set<FlowNodeType>(["summary", "redirect"]);

type View = "list" | "canvas";

function UnifiedEditorPage() {
  const { formId } = Route.useParams();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>("list");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const ensuredRef = useRef(false);

  const { data: allForms = [] } = useQuery({
    queryKey: ["forms"],
    queryFn: () => getForms(),
  });
  const form = (allForms as any[]).find((f: any) => f.id === Number(formId));
  const isPublished = form?.status === "published";

  const { data: flowData, isLoading } = useQuery({
    queryKey: ["flow", formId],
    queryFn: () => getFlow({ data: { formId: Number(formId) } }),
    enabled: !!formId,
  });

  const { data: gateways = [] } = useQuery({
    queryKey: ["gateways"],
    queryFn: () => getActiveGateways(),
  });

  const flowId = flowData?.flow.id ?? null;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["flow", formId] });

  // ── Optimistic updates ──
  // Mutating the cached flow in `onMutate` makes the List/Canvas reflect a
  // change instantly (no waiting for the POST + refetch round-trips). The
  // server runs in the background; `onSettled` refetches to swap any temp IDs
  // for real ones, and `onError` rolls back to the pre-mutation snapshot.
  type FlowCache = {
    flow: { id: number } & Record<string, unknown>;
    nodes: FlowNode[];
    edges: FlowEdge[];
    variables: FlowVariable[];
  };
  const flowKey = ["flow", formId];

  function optimistic<TVars>(apply: (draft: FlowCache, vars: TVars) => void) {
    return {
      onMutate: async (vars: TVars) => {
        await queryClient.cancelQueries({ queryKey: flowKey });
        const prev = queryClient.getQueryData<FlowCache>(flowKey);
        if (prev) {
          const draft = structuredClone(prev);
          apply(draft, vars);
          queryClient.setQueryData(flowKey, draft);
        }
        return { prev };
      },
      onError: (_e: unknown, _v: TVars, ctx?: { prev?: FlowCache }) => {
        if (ctx?.prev) queryClient.setQueryData(flowKey, ctx.prev);
      },
      onSettled: () => {
        invalidate();
      },
    };
  }

  /** Remove a node and re-stitch its primary predecessor → successor in place. */
  function spliceNodeOut(draft: FlowCache, nodeId: number) {
    const incoming = draft.edges
      .filter((e) => e.targetNodeId === nodeId)
      .sort((a, b) => a.id - b.id)[0];
    const outgoing = primaryOutgoingEdge(draft.edges, nodeId);
    draft.edges = draft.edges.filter(
      (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId,
    );
    draft.nodes = draft.nodes.filter((n) => n.id !== nodeId);
    if (incoming && outgoing && incoming.sourceNodeId !== outgoing.targetNodeId) {
      draft.edges.push({
        id: -Math.floor(Math.random() * 1e9),
        flowId: draft.flow.id,
        sourceNodeId: incoming.sourceNodeId,
        targetNodeId: outgoing.targetNodeId,
        metadata: {},
      });
    }
  }

  // Lazily ensure every form is flow-backed: if there's no flow yet, build one
  // (from existing fields, or a blank Start → Summary).
  const ensureMutation = useMutation({
    mutationFn: () => ensureFlow({ data: { formId: Number(formId) } }),
    onSuccess: invalidate,
  });
  useEffect(() => {
    if (!isLoading && flowData === null && !ensuredRef.current) {
      ensuredRef.current = true;
      ensureMutation.mutate();
    }
  }, [isLoading, flowData, ensureMutation]);

  // Validate the current flow whenever its definition changes.
  const validation = useMemo(() => {
    if (!flowData)
      return {
        errors: [] as FlowValidationError[],
        byNode: new Map<number, string[]>(),
      };
    const errors = new FlowValidator().validate(
      flowData.nodes,
      flowData.edges,
      flowData.variables,
    );
    const byNode = new Map<number, string[]>();
    for (const e of errors) {
      if (e.nodeId == null) continue;
      byNode.set(e.nodeId, [...(byNode.get(e.nodeId) ?? []), e.message]);
    }
    return { errors, byNode };
  }, [flowData]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync server flow data into React Flow state (Canvas view).
  useEffect(() => {
    if (!flowData) return;
    setNodes(
      flowData.nodes.map((n) => {
        const messages = validation.byNode.get(n.id);
        return {
          id: String(n.id),
          type: n.type,
          position: { x: n.positionX, y: n.positionY },
          data: {
            label: n.label ?? FLOW_LABELS[n.type],
            config: n.config,
            hasError: !!messages,
            errorCount: messages?.length,
            errorMessages: messages,
            // Injected for the Field Group container's inline editing (Canvas).
            variables: flowData.variables,
            onUpdateConfig: (config: Record<string, unknown>) =>
              updateNodeMutation.mutate({ nodeId: n.id, config }),
          } as FlowNodeData,
        };
      }),
    );
    setEdges(
      flowData.edges.map((e) => ({
        id: String(e.id),
        source: String(e.sourceNodeId),
        target: String(e.targetNodeId),
        label: e.metadata?.matchValue,
        type: "smoothstep",
      })),
    );
  }, [flowData, validation, setNodes, setEdges]);

  // ── Mutations ──
  const publishMutation = useMutation({
    mutationFn: (status: "draft" | "published") =>
      updateForm({ data: { id: Number(formId), status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  });

  const addNodeMutation = useMutation({
    mutationFn: (vars: {
      type: FlowNodeType;
      positionX: number;
      positionY: number;
    }) =>
      addFlowNode({
        data: {
          flowId: flowId!,
          type: vars.type,
          positionX: vars.positionX,
          positionY: vars.positionY,
          label: FLOW_LABELS[vars.type],
        },
      }),
    onSuccess: invalidate,
  });

  const insertNodeMutation = useMutation({
    mutationFn: (vars: {
      type: FlowNodeType;
      afterNodeId: number;
      fieldType?: string;
      label?: string;
    }) => insertNodeInPath({ data: { flowId: flowId!, ...vars } }),
    onSuccess: invalidate,
  });

  const removeNodeMutation = useMutation({
    mutationFn: (nodeId: number) =>
      removeNodeFromPath({ data: { flowId: flowId!, nodeId } }),
    ...optimistic<number>((draft, nodeId) => spliceNodeOut(draft, nodeId)),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedNodeIds: number[]) =>
      reorderPath({ data: { flowId: flowId!, orderedNodeIds } }),
    ...optimistic<number[]>((draft, orderedNodeIds) => {
      const idSet = new Set(orderedNodeIds);
      // Drop edges internal to the reordered set, then rebuild the chain.
      const kept = draft.edges.filter(
        (e) => !(idSet.has(e.sourceNodeId) && idSet.has(e.targetNodeId)),
      );
      let temp = -1;
      const chain: FlowEdge[] = [];
      for (let i = 0; i < orderedNodeIds.length - 1; i++) {
        chain.push({
          id: temp--,
          flowId: draft.flow.id,
          sourceNodeId: orderedNodeIds[i],
          targetNodeId: orderedNodeIds[i + 1],
          metadata: {},
        });
      }
      draft.edges = [...kept, ...chain];
    }),
  });

  const moveFieldToGroupMutation = useMutation({
    mutationFn: (vars: { nodeId: number; groupId: number }) =>
      moveFieldIntoGroup({ data: { flowId: flowId!, ...vars } }),
    ...optimistic<{ nodeId: number; groupId: number }>(
      (draft, { nodeId, groupId }) => {
        const node = draft.nodes.find((n) => n.id === nodeId);
        const group = draft.nodes.find((n) => n.id === groupId);
        if (!node || !group) return;
        const cfg = node.config ?? {};
        const grouped: GroupedField = {
          id: `temp_${Math.random().toString(36).slice(2, 10)}`,
          fieldType: (cfg.fieldType as string) ?? "text",
          label: (cfg.label as string) || node.label || "Field",
          placeholder: cfg.placeholder as string | undefined,
          required: Boolean(cfg.required),
          options: cfg.options as { label: string; value: string }[] | undefined,
          bindToVariable: cfg.bindToVariable as string | undefined,
        };
        const existing = (group.config.fields as GroupedField[] | undefined) ?? [];
        group.config = { ...group.config, fields: [...existing, grouped] };
        spliceNodeOut(draft, nodeId);
      },
    ),
  });

  const addEdgeMutation = useMutation({
    mutationFn: (vars: { sourceNodeId: number; targetNodeId: number }) =>
      addFlowEdge({ data: { flowId: flowId!, ...vars } }),
    onSuccess: invalidate,
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: number) =>
      deleteFlowNode({ data: { flowId: flowId!, nodeId } }),
    ...optimistic<number>((draft, nodeId) => {
      // Canvas delete: drop the node and every edge touching it.
      draft.nodes = draft.nodes.filter((n) => n.id !== nodeId);
      draft.edges = draft.edges.filter(
        (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId,
      );
    }),
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: (edgeId: number) =>
      deleteFlowEdge({ data: { flowId: flowId!, edgeId } }),
    onSuccess: invalidate,
  });

  const saveLayoutMutation = useMutation({
    mutationFn: (
      layout: { id: number; positionX: number; positionY: number }[],
    ) => saveFlowLayout({ data: { flowId: flowId!, nodes: layout } }),
  });

  const updateNodeMutation = useMutation({
    mutationFn: (vars: {
      nodeId: number;
      config?: Record<string, unknown>;
      label?: string;
    }) => updateFlowNode({ data: { flowId: flowId!, ...vars } }),
    ...optimistic<{
      nodeId: number;
      config?: Record<string, unknown>;
      label?: string;
    }>((draft, vars) => {
      const node = draft.nodes.find((n) => n.id === vars.nodeId);
      if (!node) return;
      if (vars.config !== undefined)
        node.config = vars.config as FlowNode["config"];
      if (vars.label !== undefined) node.label = vars.label;
    }),
  });

  const createVarMutation = useMutation({
    mutationFn: (v: {
      name: string;
      type: FlowVariableType;
      defaultValue?: string;
      description?: string;
    }) => createFlowVariable({ data: { flowId: flowId!, ...v } }),
    onSuccess: invalidate,
  });
  const updateVarMutation = useMutation({
    mutationFn: (vars: {
      varId: number;
      name?: string;
      type?: FlowVariableType;
      defaultValue?: string | null;
      description?: string | null;
    }) => updateFlowVariable({ data: { flowId: flowId!, ...vars } }),
    onSuccess: invalidate,
  });
  const deleteVarMutation = useMutation({
    mutationFn: (varId: number) =>
      deleteFlowVariable({ data: { flowId: flowId!, varId } }),
    onSuccess: invalidate,
  });

  // ── List-view add: find the anchor (last node before the terminal). ──
  const listAnchorId = useMemo(() => {
    if (!flowData) return null;
    const { ordered } = linearizePrimaryPath(flowData.nodes, flowData.edges);
    if (ordered.length === 0) return null;
    const byId = new Map(flowData.nodes.map((n) => [n.id, n]));
    const termIndex = ordered.findIndex((id) =>
      TERMINAL_TYPES.has(byId.get(id)!.type),
    );
    if (termIndex > 0) return ordered[termIndex - 1];
    if (termIndex === 0) return ordered[0]; // only start? insert after start
    return ordered[ordered.length - 1];
  }, [flowData]);

  const handleAddField = useCallback(
    (fieldType: string) => {
      if (!flowId || listAnchorId == null) return;
      insertNodeMutation.mutate({
        type: "form_field",
        afterNodeId: listAnchorId,
        fieldType,
        label: "",
      });
    },
    [flowId, listAnchorId, insertNodeMutation],
  );

  const handleAddLogic = useCallback(
    (type: Exclude<FlowNodeType, "start" | "form_field">) => {
      if (!flowId || listAnchorId == null) return;
      insertNodeMutation.mutate({
        type,
        afterNodeId: listAnchorId,
        label: FLOW_LABELS[type],
      });
    },
    [flowId, listAnchorId, insertNodeMutation],
  );

  // ── Canvas handlers ──
  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: "smoothstep" }, eds));
      addEdgeMutation.mutate({
        sourceNodeId: Number(connection.source),
        targetNodeId: Number(connection.target),
      });
    },
    [setEdges, addEdgeMutation],
  );

  const handleDropNode = useCallback(
    (
      type: Exclude<FlowNodeType, "start">,
      position: { x: number; y: number },
    ) => {
      addNodeMutation.mutate({
        type,
        positionX: position.x,
        positionY: position.y,
      });
    },
    [addNodeMutation],
  );

  const handleNodeDragStop = useCallback(() => {
    if (!flowId) return;
    saveLayoutMutation.mutate(
      nodes.map((n) => ({
        id: Number(n.id),
        positionX: n.position.x,
        positionY: n.position.y,
      })),
    );
  }, [flowId, nodes, saveLayoutMutation]);

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const n of deleted) {
        if (n.type === "start") continue;
        deleteNodeMutation.mutate(Number(n.id));
      }
    },
    [deleteNodeMutation],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const e of deleted) deleteEdgeMutation.mutate(Number(e.id));
    },
    [deleteEdgeMutation],
  );

  const handleSaveNow = useCallback(() => {
    if (!flowId) return;
    saveLayoutMutation.mutate(
      nodes.map((n) => ({
        id: Number(n.id),
        positionX: n.position.x,
        positionY: n.position.y,
      })),
    );
  }, [flowId, nodes, saveLayoutMutation]);

  // Simple layered auto-layout (BFS levels from Start).
  const handleAutoLayout = useCallback(() => {
    if (!flowData) return;
    const level = new Map<number, number>();
    const start = flowData.nodes.find((n) => n.type === "start");
    if (!start) return;
    const queue: number[] = [start.id];
    level.set(start.id, 0);
    while (queue.length) {
      const id = queue.shift()!;
      const lvl = level.get(id)!;
      for (const e of flowData.edges.filter((e) => e.sourceNodeId === id)) {
        if (!level.has(e.targetNodeId)) {
          level.set(e.targetNodeId, lvl + 1);
          queue.push(e.targetNodeId);
        }
      }
    }
    const byLevel = new Map<number, number[]>();
    for (const n of flowData.nodes) {
      const lvl = level.get(n.id) ?? 0;
      byLevel.set(lvl, [...(byLevel.get(lvl) ?? []), n.id]);
    }
    const layout: { id: number; positionX: number; positionY: number }[] = [];
    for (const [lvl, ids] of byLevel) {
      ids.forEach((id, i) => {
        layout.push({
          id,
          positionX: 120 + i * 280,
          positionY: 60 + lvl * 150,
        });
      });
    }
    setNodes((nds) =>
      nds.map((n) => {
        const pos = layout.find((l) => l.id === Number(n.id));
        return pos
          ? { ...n, position: { x: pos.positionX, y: pos.positionY } }
          : n;
      }),
    );
    saveLayoutMutation.mutate(layout);
  }, [flowData, setNodes, saveLayoutMutation]);

  const selectedNode =
    flowData?.nodes.find((n) => String(n.id) === selectedNodeId) ?? null;

  const loading = isLoading || flowData === null || ensureMutation.isPending;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e6dfd8] bg-[#faf9f5] px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="text-sm text-[#6c6a64] hover:text-[#141413]"
          >
            ← Dashboard
          </Link>
          <span className="text-[#e6dfd8]">/</span>
          <span className="text-sm font-medium text-[#141413]">
            {form?.title ?? "Loading…"}
          </span>
          {form && (
            <Badge variant={form.status as "draft" | "published"}>
              {form.status}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Build | Responses tabs */}
          <nav className="flex rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-0.5 text-sm">
            <span className="flex items-center gap-1 rounded-md bg-white px-3 py-1 font-medium text-[#141413] shadow-sm">
              <span className="text-xs text-[#cc785c]">◆</span> Build
            </span>
            <Link
              to="/forms/$formId/submissions"
              params={{ formId }}
              className="rounded-md px-3 py-1 text-[#6c6a64] hover:text-[#141413]"
            >
              Responses
            </Link>
          </nav>

          {/* Variables & Valid live in the build sub-toolbar (shown in both
              List and Canvas); only page-level actions remain in the header. */}
          <button
            onClick={() => {
              setPreviewOpen(true);
              setSelectedNodeId(null);
              setShowVariables(false);
            }}
            className="rounded-md border border-[#e6dfd8] bg-[#f5f0e8] px-3 py-1.5 text-sm text-[#6c6a64] hover:bg-[#e8e0d2] hover:text-[#141413] transition-colors"
          >
            Preview
          </button>

          {isPublished && (
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-[#f5f0e8] px-3 py-1.5 text-sm text-[#6c6a64] hover:bg-[#e8e0d2] hover:text-[#141413] transition-colors"
            >
              <span className="text-xs">↗</span> Share
            </button>
          )}

          <Button
            variant={isPublished ? "secondary" : "primary"}
            size="sm"
            onClick={() =>
              publishMutation.mutate(isPublished ? "draft" : "published")
            }
            disabled={publishMutation.isPending}
          >
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      {previewOpen && flowData && (
        <PreviewDialog
          title={form?.title ?? "Form"}
          onClose={() => setPreviewOpen(false)}
        >
          <FlowPreviewModal
            nodes={flowData.nodes}
            edges={flowData.edges}
            variables={flowData.variables}
          />
        </PreviewDialog>
      )}
      {shareOpen && (
        <ShareDialog
          formId={Number(formId)}
          title={form?.title ?? "Form"}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Validation list */}
      {validateOpen && (
        <div className="max-h-44 overflow-y-auto border-b border-[#e6dfd8] bg-[#fbf6f0] px-6 py-2">
          {validation.errors.length === 0 ? (
            <p className="text-sm text-[#2f7d52]">
              No validation issues. This form is ready.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {validation.errors.map((e, i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      if (e.nodeId != null) {
                        setSelectedNodeId(String(e.nodeId));
                        setShowVariables(false);
                      }
                    }}
                    className="text-left text-sm text-[#c64545] hover:underline"
                  >
                    • {e.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[#8e8b82]">
          Preparing editor…
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: unified palette */}
          <div className="w-60 flex-none overflow-y-auto border-r border-[#e6dfd8] bg-[#faf9f5] p-4">
            <BuilderPalette
              onAddField={handleAddField}
              onAddNode={handleAddLogic}
            />
          </div>

          {/* Center: view toggle + (list | canvas) */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-2">
              <div className="flex rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-0.5 text-sm">
                <button
                  onClick={() => setView("list")}
                  className={`rounded-md px-3 py-1 ${
                    view === "list"
                      ? "bg-white font-medium text-[#141413] shadow-sm"
                      : "text-[#6c6a64] hover:text-[#141413]"
                  }`}
                >
                  ☰ List
                </button>
                <button
                  onClick={() => setView("canvas")}
                  className={`rounded-md px-3 py-1 ${
                    view === "canvas"
                      ? "bg-white font-medium text-[#141413] shadow-sm"
                      : "text-[#6c6a64] hover:text-[#141413]"
                  }`}
                >
                  ◇ Canvas
                </button>
              </div>
              {/* Shared action bar — shown in both List and Canvas. Auto-layout
                  is Canvas-only; Preview lives in the page header. */}
              <FlowToolbar
                errorCount={validation.errors.length}
                validateOpen={validateOpen}
                variablesOpen={showVariables}
                saving={saveLayoutMutation.isPending}
                saved={!saveLayoutMutation.isPending}
                onSave={handleSaveNow}
                onToggleValidate={() => setValidateOpen((v) => !v)}
                onToggleVariables={() => {
                  setShowVariables((s) => !s);
                  setSelectedNodeId(null);
                }}
                onAutoLayout={view === "canvas" ? handleAutoLayout : undefined}
              />
            </div>

            {view === "list" ? (
              <div
                className="flex-1 overflow-y-auto bg-[#f5f0e8] p-6"
                onClick={() => setSelectedNodeId(null)}
              >
                <div
                  className="mx-auto max-w-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {flowData && (
                    <FlowListBuilder
                      nodes={flowData.nodes}
                      edges={flowData.edges}
                      selectedNodeId={
                        selectedNodeId == null ? null : Number(selectedNodeId)
                      }
                      byNodeErrors={validation.byNode}
                      variables={flowData.variables}
                      onSelect={(id) =>
                        setSelectedNodeId(id == null ? null : String(id))
                      }
                      onReorder={(orderedNodeIds) =>
                        reorderMutation.mutate(orderedNodeIds)
                      }
                      onUpdateNode={(nodeId, config) =>
                        updateNodeMutation.mutate({ nodeId, config })
                      }
                      onDelete={(nodeId) => {
                        removeNodeMutation.mutate(nodeId);
                        if (selectedNodeId === String(nodeId))
                          setSelectedNodeId(null);
                      }}
                      onMoveFieldToGroup={(nodeId, groupId) =>
                        moveFieldToGroupMutation.mutate({ nodeId, groupId })
                      }
                      onEditBranchesInCanvas={() => setView("canvas")}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <FlowCanvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={handleConnect}
                  onNodeClick={(id) => {
                    setSelectedNodeId(id);
                    setShowVariables(false);
                  }}
                  onPaneClick={() => setSelectedNodeId(null)}
                  onDropNode={handleDropNode}
                  onNodeDragStop={handleNodeDragStop}
                  onNodesDelete={handleNodesDelete}
                  onEdgesDelete={handleEdgesDelete}
                />
              </div>
            )}
          </div>

          {/* Right: variables, node config, or hint */}
          <div
            ref={rightPanelRef}
            className="relative flex-none overflow-y-auto border-l border-[#e6dfd8] bg-[#faf9f5]"
            style={{ width: rightPanelWidth + "px" }}
          >
            {/* Resize handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                isResizing.current = true;
                const startX = e.clientX;
                const startWidth = rightPanelWidth;

                function onMouseMove(ev: MouseEvent) {
                  if (!isResizing.current) return;
                  const newWidth = startWidth - (ev.clientX - startX);
                  setRightPanelWidth(Math.max(240, Math.min(600, newWidth)));
                }

                function onMouseUp() {
                  isResizing.current = false;
                  document.removeEventListener("mousemove", onMouseMove);
                  document.removeEventListener("mouseup", onMouseUp);
                  document.body.style.cursor = "";
                  document.body.style.userSelect = "";
                }

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
              className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-[#cc785c]/30 active:bg-[#cc785c]/50 transition-colors"
            />
            <div className="p-4">
              {showVariables ? (
                flowData && (
                  <VariablesManager
                    variables={flowData.variables}
                    nodes={flowData.nodes}
                    onCreate={(v) => createVarMutation.mutate(v)}
                    onUpdate={(varId, changes) =>
                      updateVarMutation.mutate({ varId, ...changes })
                    }
                    onDelete={(varId) => deleteVarMutation.mutate(varId)}
                    onClose={() => setShowVariables(false)}
                  />
                )
              ) : selectedNode && flowData ? (
                <NodeConfigPanel
                  node={selectedNode}
                  variables={flowData.variables}
                  gateways={gateways as { id: number; name: string }[]}
                  onUpdate={(nodeId, patch) =>
                    updateNodeMutation.mutate({ nodeId, ...patch })
                  }
                  onClose={() => setSelectedNodeId(null)}
                  onDelete={(nodeId) => {
                    removeNodeMutation.mutate(nodeId);
                    setSelectedNodeId(null);
                  }}
                />
              ) : (
                <div className="pt-8 text-center text-sm text-[#8e8b82]">
                  Click a step to configure it. Add fields and logic from the
                  left panel.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
