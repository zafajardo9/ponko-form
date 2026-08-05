import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronUp,
  Eye,
  Settings,
  Share2,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import { requireAuth } from "@/lib/server-fns/auth";
import {
  getEditorForm,
  updateForm,
} from "@/lib/server-fns/forms";
import {
  ensurePageForm,
  type SavedPageForm,
} from "@/lib/server-fns/page-forms";
import {
  applySavedPageForm,
  type EditorFormData,
} from "@/lib/editor-cache";
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
} from "@/lib/server-fns/flow-nodes";
import {
  createFlowVariable,
  updateFlowVariable,
  deleteFlowVariable,
} from "@/lib/server-fns/flow-variables";
import { getActiveGateways } from "@/lib/server-fns/gateways";
import { FlowToolbar } from "@/components/flow-builder/FlowToolbar";
import {
  Button,
  navigationBackIconClass,
  navigationButtonClass,
} from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLogo } from "@/components/ui/AppLogo";
import { PreviewDialog } from "@/components/ui/PreviewDialog";
import { useToast } from "@/components/ui/Toast";
import { FormSectionNav } from "@/components/forms/FormSectionNav";
import { ShareDialog } from "@/components/dashboard/ShareDialog";
import { UserMenu } from "@/components/auth/UserMenu";
import { ShareFormDialog } from "@/components/forms/ShareFormDialog";
import { SettingsDialog } from "@/components/flow-builder/SettingsDialog";
import { themeVars, type FormTheme } from "@/lib/theme";
import { appConfig } from "@/utils/app-config";
import type { FormPage, FormReference } from "@/lib/page-builder/types";
import { FlowValidator } from "@/lib/flow-engine/FlowValidator";
import {
  linearizePrimaryPath,
  primaryOutgoingEdge,
} from "@/lib/flow-engine/path-utils";
import type {
  FlowNode,
  FlowEdge,
  FlowVariable,
  FlowNodeType,
  FlowVariableType,
  FlowValidationError,
  GroupedField,
} from "@/lib/flow-engine/types";
import type { FlowCanvasWorkspaceHandle } from "@/components/flow-builder/FlowCanvasWorkspace";

const PageFormView = lazy(() =>
  import("@/components/page-form/PageFormView").then((module) => ({
    default: module.PageFormView,
  })),
);

const PageBuilderWorkspace = lazy(() =>
  import("@/components/page-builder/PageBuilderWorkspace").then(
    (module) => ({ default: module.PageBuilderWorkspace }),
  ),
);

const FlowCanvasWorkspace = lazy(() =>
  import("@/components/flow-builder/FlowCanvasWorkspace").then(
    (module) => ({ default: module.FlowCanvasWorkspace }),
  ),
);

const BuilderPalette = lazy(() =>
  import("@/components/flow-builder/BuilderPalette").then((module) => ({
    default: module.BuilderPalette,
  })),
);

const FlowListBuilder = lazy(() =>
  import("@/components/flow-builder/FlowListBuilder").then((module) => ({
    default: module.FlowListBuilder,
  })),
);

const NodeConfigPanel = lazy(() =>
  import("@/components/flow-builder/NodeConfigPanel").then((module) => ({
    default: module.NodeConfigPanel,
  })),
);

const VariablesManager = lazy(() =>
  import("@/components/flow-builder/VariablesManager").then((module) => ({
    default: module.VariablesManager,
  })),
);

const FlowPreviewModal = lazy(() =>
  import("@/components/ui/FlowPreviewModal").then((module) => ({
    default: module.FlowPreviewModal,
  })),
);

export const Route = createFileRoute("/forms/$formId/edit")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { preview?: boolean } =>
    search.preview === true || search.preview === "true"
      ? { preview: true }
      : {},
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
  const { preview } = Route.useSearch();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [view, setView] = useState<View>("list");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(preview === true);
  const [shareOpen, setShareOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pagePreviewDraft, setPagePreviewDraft] = useState<{
    pages: FormPage[];
    references: FormReference[];
  } | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(288);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<FlowCanvasWorkspaceHandle>(null);
  const isResizing = useRef(false);
  const ensuredRef = useRef(false);

  const {
    data: editorData,
    isLoading,
    isError: editorError,
    error: editorQueryError,
  } = useQuery({
    queryKey: ["editor-form", formId],
    queryFn: () => getEditorForm({ data: { formId: Number(formId) } }),
    enabled: !!formId,
  });
  const form = editorData?.form;
  const flowData = editorData?.flow;
  const pageForm = editorData?.pageForm;
  const isPublished = form?.status === "published";

  const { data: gateways = [] } = useQuery({
    queryKey: ["gateways"],
    queryFn: () => getActiveGateways(),
  });

  const flowId = flowData?.flow.id ?? null;
  function requireFlowId() {
    if (flowId == null) throw new Error("The flow is not ready yet");
    return flowId;
  }
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["editor-form", formId] });
  const invalidateFormMetadata = () =>
    Promise.all([
      invalidate(),
      queryClient.invalidateQueries({ queryKey: ["forms"] }),
    ]);

  const handlePagePreviewDraft = useCallback(
    (draft: { pages: FormPage[]; references: FormReference[] }) => {
      setPagePreviewDraft(draft);
    },
    [],
  );

  const handlePageSaved = useCallback(
    (saved: SavedPageForm) => {
      queryClient.setQueryData<EditorFormData>(
        ["editor-form", formId],
        (current) => applySavedPageForm(current, saved),
      );
      setPagePreviewDraft(null);
    },
    [formId, queryClient],
  );

  useEffect(() => {
    ensuredRef.current = false;
    setPagePreviewDraft(null);
  }, [formId]);

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
    if (
      incoming &&
      outgoing &&
      incoming.sourceNodeId !== outgoing.targetNodeId
    ) {
      draft.edges.push({
        id: -Math.floor(Math.random() * 1e9),
        flowId: draft.flow.id,
        sourceNodeId: incoming.sourceNodeId,
        targetNodeId: outgoing.targetNodeId,
        metadata: {},
      });
    }
  }

  const ensurePageMutation = useMutation({
    mutationFn: () => ensurePageForm({ data: { formId: Number(formId) } }),
    onSuccess: invalidate,
  });
  useEffect(() => {
    if (isLoading || ensuredRef.current || !editorData) return;
    if (pageForm) return;
    if (flowData === null) {
      ensuredRef.current = true;
      ensurePageMutation.mutate();
    }
  }, [isLoading, editorData, pageForm, flowData, ensurePageMutation]);

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

  // ── Mutations ──
  const publishMutation = useMutation({
    mutationFn: (status: "draft" | "published") =>
      updateForm({ data: { id: Number(formId), status } }),
    onSuccess: async (_result, status) => {
      await invalidateFormMetadata()
      toast.success(
        status === "published" ? "Form published" : "Form unpublished",
        status === "published"
          ? "The public form now uses your latest saved version."
          : "The public link no longer accepts new responses.",
      )
    },
    onError: (error) =>
      toast.error(
        "Publication status was not updated",
        error instanceof Error ? error.message : "Try again in a moment.",
      ),
  });

  const settingsMutation = useMutation({
    mutationFn: ({ title, theme }: { title: string; theme: FormTheme }) =>
      updateForm({ data: { id: Number(formId), title, theme } }),
    onSuccess: async () => {
      await invalidateFormMetadata()
      toast.success("Form settings saved", "The title and appearance have been updated.")
    },
    onError: (error) =>
      toast.error(
        "Form settings were not saved",
        error instanceof Error ? error.message : "Try again in a moment.",
      ),
  });

  const addNodeMutation = useMutation({
    mutationFn: (vars: {
      type: FlowNodeType;
      positionX: number;
      positionY: number;
    }) =>
      addFlowNode({
        data: {
          flowId: requireFlowId(),
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
    }) => insertNodeInPath({ data: { flowId: requireFlowId(), ...vars } }),
    onSuccess: invalidate,
  });

  const removeNodeMutation = useMutation({
    mutationFn: (nodeId: number) =>
      removeNodeFromPath({ data: { flowId: requireFlowId(), nodeId } }),
    ...optimistic<number>((draft, nodeId) => spliceNodeOut(draft, nodeId)),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedNodeIds: number[]) =>
      reorderPath({ data: { flowId: requireFlowId(), orderedNodeIds } }),
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
      moveFieldIntoGroup({ data: { flowId: requireFlowId(), ...vars } }),
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
          options: cfg.options as
            | { label: string; value: string }[]
            | undefined,
          bindToVariable: cfg.bindToVariable as string | undefined,
        };
        const existing =
          (group.config.fields as GroupedField[] | undefined) ?? [];
        group.config = { ...group.config, fields: [...existing, grouped] };
        spliceNodeOut(draft, nodeId);
      },
    ),
  });

  const addEdgeMutation = useMutation({
    mutationFn: (vars: { sourceNodeId: number; targetNodeId: number }) =>
      addFlowEdge({ data: { flowId: requireFlowId(), ...vars } }),
    onSuccess: invalidate,
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: number) =>
      deleteFlowNode({ data: { flowId: requireFlowId(), nodeId } }),
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
      deleteFlowEdge({ data: { flowId: requireFlowId(), edgeId } }),
    onSuccess: invalidate,
  });

  const saveLayoutMutation = useMutation({
    mutationFn: (
      layout: { id: number; positionX: number; positionY: number }[],
    ) => saveFlowLayout({ data: { flowId: requireFlowId(), nodes: layout } }),
  });

  const updateNodeMutation = useMutation({
    mutationFn: (vars: {
      nodeId: number;
      config?: Record<string, unknown>;
      label?: string;
    }) => updateFlowNode({ data: { flowId: requireFlowId(), ...vars } }),
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
    }) => createFlowVariable({ data: { flowId: requireFlowId(), ...v } }),
    onSuccess: invalidate,
  });
  const updateVarMutation = useMutation({
    mutationFn: (vars: {
      varId: number;
      name?: string;
      type?: FlowVariableType;
      defaultValue?: string | null;
      description?: string | null;
    }) => updateFlowVariable({ data: { flowId: requireFlowId(), ...vars } }),
    onSuccess: invalidate,
  });
  const deleteVarMutation = useMutation({
    mutationFn: (varId: number) =>
      deleteFlowVariable({ data: { flowId: requireFlowId(), varId } }),
    onSuccess: invalidate,
  });

  // ── List-view add: find the anchor (last node before the terminal). ──
  const listAnchorId = useMemo(() => {
    if (!flowData) return null;
    const { ordered } = linearizePrimaryPath(flowData.nodes, flowData.edges);
    if (ordered.length === 0) return null;
    const byId = new Map(flowData.nodes.map((n) => [n.id, n]));
    const termIndex = ordered.findIndex((id) => {
      const node = byId.get(id);
      return node ? TERMINAL_TYPES.has(node.type) : false;
    });
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

  const handleSaveNow = useCallback(() => {
    if (view === "canvas") {
      canvasRef.current?.saveNow(true);
      return;
    }
    if (!flowData) return;
    saveLayoutMutation.mutate(
      flowData.nodes.map((node) => ({
        id: node.id,
        positionX: node.positionX,
        positionY: node.positionY,
      })),
      {
        onSuccess: () =>
          toast.success("Flow layout saved", "Node positions are now recorded."),
        onError: (error) =>
          toast.error(
            "Flow layout was not saved",
            error instanceof Error ? error.message : "Try again in a moment.",
          ),
      },
    );
  }, [flowData, saveLayoutMutation, toast, view]);

  const handleAutoLayout = useCallback(() => {
    canvasRef.current?.autoLayout();
  }, []);

  const selectedNode =
    flowData?.nodes.find((n) => String(n.id) === selectedNodeId) ?? null;

  const hasPageBuilder = !!pageForm?.pages.length;
  const pageSetupStalled =
    !isLoading &&
    !!editorData &&
    !pageForm &&
    flowData === null &&
    ensuredRef.current &&
    ensurePageMutation.isSuccess &&
    !ensurePageMutation.isPending;
  const setupError =
    (editorError ? editorQueryError : null) ||
    ensurePageMutation.error ||
    (pageSetupStalled
      ? new Error("The page builder was created, but the editor could not reload it.")
      : null);
  const loading =
    !setupError &&
    (isLoading ||
      !editorData ||
      (hasPageBuilder
        ? ensurePageMutation.isPending
        : flowData === null));

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      {/* Focused editor chrome */}
      <div
        id="editor-toolbar"
        className="z-40 flex flex-none flex-wrap items-center border-b border-[#ded8cf] bg-[#faf9f5]/98 px-3 shadow-[0_2px_10px_rgba(20,20,19,0.045)] backdrop-blur-sm sm:px-4"
      >
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5">
          <Link
            to="/"
            aria-label={`${appConfig.name} home`}
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
          >
            <AppLogo className="h-7 w-7 rounded-lg" fallbackClassName="bg-[#cc785c] text-sm font-bold text-white" />
            <span className="hidden text-sm font-semibold tracking-tight text-[#141413] 2xl:inline">
              {appConfig.name}
            </span>
          </Link>

          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[#ded8cf]" />

          <Link
            to="/forms"
            aria-label="Back to forms"
            title="Back to forms"
            className={`${navigationButtonClass} h-8 flex-none px-2 sm:px-2.5`}
          >
            <ArrowLeft size={15} className={navigationBackIconClass} aria-hidden="true" />
            <span className="hidden sm:inline">Forms</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-[#141413]">
              {form?.title ?? "Loading…"}
            </span>
            {form && (
              <Badge variant={form.status as "draft" | "published"}>
                {form.status}
              </Badge>
            )}
          </div>
        </div>

        <div
          id="editor-toolbar-actions"
          aria-hidden={headerCollapsed}
          inert={headerCollapsed}
          className={`order-3 grid w-full overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none xl:order-none xl:ml-auto xl:w-auto ${
            headerCollapsed
              ? "grid-rows-[0fr] opacity-0"
              : "grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={`flex flex-row items-center justify-between gap-2 border-t border-[#e6dfd8] py-2 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:transition-none xl:border-t-0 xl:py-0 ${
                headerCollapsed ? "-translate-y-1" : "translate-y-0"
              }`}
            >
              <FormSectionNav formId={formId} active="build" />

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
                {/* Variables & Valid live in the build sub-toolbar (shown in
                    both List and Canvas); these are page-level actions. */}
                <button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(true);
                    setSelectedNodeId(null);
                    setShowVariables(false);
                  }}
                  aria-label="Preview form"
                  title="Preview form"
                  className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#ded8cf] bg-white px-2.5 text-sm text-[#5f5b55] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
                >
                  <Eye size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Form settings"
                  title="Form settings"
                  className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#ded8cf] bg-white px-2.5 text-sm text-[#5f5b55] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
                >
                  <Settings size={14} aria-hidden="true" />
                  <span className="hidden 2xl:inline">Settings</span>
                </button>

                {isPublished && (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    aria-label="Share form"
                    title="Share form"
                    className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#ded8cf] bg-white px-2.5 text-sm text-[#5f5b55] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
                  >
                    <Share2 size={14} aria-hidden="true" />
                    <span className="hidden 2xl:inline">Share</span>
                  </button>
                )}

                {form?.accessRole === "owner" && (
                  <button
                    type="button"
                    onClick={() => setAccessOpen(true)}
                    aria-label="Manage form access"
                    title="Manage form access"
                    className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-[#ded8cf] bg-white px-2.5 text-sm text-[#5f5b55] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
                  >
                    <Share2 size={14} aria-hidden="true" />
                    <span className="hidden 2xl:inline">Access</span>
                  </button>
                )}

                <Button
                  variant={isPublished ? "secondary" : "primary"}
                  size="sm"
                  onClick={() =>
                    publishMutation.mutate(isPublished ? "draft" : "published")
                  }
                  disabled={publishMutation.isPending}
                  className="flex-none"
                >
                  {isPublished ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHeaderCollapsed((collapsed) => !collapsed)}
            aria-label={headerCollapsed ? "Show editor toolbar" : "Minimize editor toolbar"}
            aria-controls="editor-toolbar-actions"
            aria-expanded={!headerCollapsed}
            title={headerCollapsed ? "Show editor toolbar" : "Minimize editor toolbar"}
            className="group flex h-8 w-8 items-center justify-center rounded-md border border-[#ded8cf] bg-white text-[#6c6a64] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-1 motion-reduce:transition-none"
          >
            <ChevronUp
              size={15}
              aria-hidden="true"
              className={`transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                headerCollapsed ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
          <span className="hidden h-5 w-px bg-[#ded8cf] sm:block" aria-hidden="true" />
          <UserMenu />
        </div>
      </div>

      {/* Dialogs */}
      {previewOpen && (pageForm || flowData) && (
        <PreviewDialog
          title={form?.title ?? "Form"}
          onClose={() => setPreviewOpen(false)}
        >
          <div
            style={themeVars((form?.theme as FormTheme | null) ?? null)}
            className="rounded-lg bg-[var(--ponko-bg,#faf9f5)] p-4 sm:p-6"
          >
            {pageForm ? (
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="h-64 animate-pulse rounded-xl bg-[#efe9de]"
                  >
                    <span className="sr-only">Loading preview…</span>
                  </div>
                }
              >
                <PageFormView
                  title={form?.title ?? "Form"}
                  description={form?.description}
                  pages={pagePreviewDraft?.pages ?? pageForm.pages}
                  references={pagePreviewDraft?.references ?? pageForm.references ?? []}
                  recaptchaSiteKey={pageForm.recaptchaSiteKey}
                  theme={(form?.theme as FormTheme | null) ?? null}
                  preview
                />
              </Suspense>
            ) : flowData ? (
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="h-64 animate-pulse rounded-xl bg-[#efe9de]"
                  >
                    <span className="sr-only">Loading preview…</span>
                  </div>
                }
              >
                <FlowPreviewModal
                  nodes={flowData.nodes}
                  edges={flowData.edges}
                  variables={flowData.variables}
                />
              </Suspense>
            ) : null}
          </div>
        </PreviewDialog>
      )}
      {shareOpen && form?.publicId && (
        <ShareDialog
          publicId={form.publicId}
          title={form?.title ?? "Form"}
          onClose={() => setShareOpen(false)}
        />
      )}
      {accessOpen && form?.accessRole === "owner" && (
        <ShareFormDialog
          formId={form.id}
          title={form.title}
          open
          onClose={() => setAccessOpen(false)}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          formTitle={form?.title ?? "Form"}
          theme={(form?.theme as FormTheme | null) ?? null}
          onSave={async (settings) => {
            try {
              await settingsMutation.mutateAsync(settings)
              setSettingsOpen(false)
            } catch {
              // Dialog stays open — user can retry
            }
          }}
          onClose={() => setSettingsOpen(false)}
          saveError={settingsMutation.isError ? (settingsMutation.error as Error)?.message ?? 'Failed to save settings.' : null}
        />
      )}

      {/* Validation list */}
      {validateOpen && (
        <div className="max-h-44 flex-none overflow-y-auto border-b border-[#e6dfd8] bg-[#fbf6f0] px-4 py-2 sm:px-6">
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
      {setupError ? (
        <div className="flex flex-1 items-center justify-center bg-[#f5f0e8] p-6">
          <div className="max-w-xl rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-6 shadow-sm">
            <p className="text-sm font-medium text-[#c64545]">Editor setup failed</p>
            <h2 className="mt-2 text-xl font-medium text-[#141413]">
              This form could not finish preparing.
            </h2>
            <p className="mt-2 text-sm text-[#6c6a64]">
              {(setupError as Error)?.message ??
                "Check your database migration and authentication session, then refresh this page."}
            </p>
            <Button
              type="button"
              className="mt-5"
              onClick={() => {
                ensuredRef.current = false;
                invalidate();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[#8e8b82]">
          Preparing editor…
        </div>
      ) : hasPageBuilder && pageForm ? (
        <Suspense
          fallback={
            <div
              role="status"
              className="flex flex-1 items-center justify-center bg-[#f5f0e8] text-sm text-[#8e8b82]"
            >
              Loading page builder…
            </div>
          }
        >
          <PageBuilderWorkspace
            formId={Number(formId)}
            pages={pageForm.pages}
            references={pageForm.references ?? []}
            gateways={gateways as { id: number; name: string; slug: string }[]}
            onChanged={handlePageSaved}
            onDraftChange={handlePagePreviewDraft}
          />
        </Suspense>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto lg:min-h-0 lg:flex-row lg:overflow-hidden">
          {/* Left: unified palette */}
          <div className="flex-none border-b border-[#e6dfd8] bg-[#faf9f5] p-4 lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <Suspense
              fallback={
                <div
                  role="status"
                  className="h-48 animate-pulse rounded-lg bg-[#efe9de]"
                >
                  <span className="sr-only">Loading builder palette…</span>
                </div>
              }
            >
              <BuilderPalette
                onAddField={handleAddField}
                onAddNode={handleAddLogic}
              />
            </Suspense>
          </div>

          {/* Center: view toggle + (list | canvas) */}
          <div className="flex min-h-[520px] flex-1 flex-col overflow-hidden lg:min-h-0">
            <div className="flex flex-col gap-2 border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-2 sm:flex-row sm:items-center">
              <div className="flex w-full rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-0.5 text-sm sm:w-auto">
                <button
                  onClick={() => setView("list")}
                  className={`flex-1 rounded-md px-3 py-1 sm:flex-none ${
                    view === "list"
                      ? "bg-white font-medium text-[#141413] shadow-sm"
                      : "text-[#6c6a64] hover:text-[#141413]"
                  }`}
                >
                  ☰ List
                </button>
                <button
                  onClick={() => setView("canvas")}
                  className={`flex-1 rounded-md px-3 py-1 sm:flex-none ${
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
                className="flex-1 overflow-y-auto bg-[#f5f0e8] p-3 sm:p-6"
                onClick={() => setSelectedNodeId(null)}
              >
                <div
                  className="mx-auto max-w-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {flowData && (
                    <Suspense
                      fallback={
                        <div
                          role="status"
                          className="h-64 animate-pulse rounded-xl bg-[#efe9de]"
                        >
                          <span className="sr-only">Loading form steps…</span>
                        </div>
                      }
                    >
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
                    </Suspense>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1">
                {flowData && (
                  <Suspense
                    fallback={
                      <div
                        role="status"
                        className="flex h-full items-center justify-center bg-[#f5f0e8] text-sm text-[#8e8b82]"
                      >
                        Loading canvas…
                      </div>
                    }
                  >
                    <FlowCanvasWorkspace
                      ref={canvasRef}
                      flow={flowData}
                      errorsByNode={validation.byNode}
                      onSelectNode={(id) => {
                        setSelectedNodeId(id);
                        if (id) setShowVariables(false);
                      }}
                      onUpdateNodeConfig={(nodeId, config) =>
                        updateNodeMutation.mutate({ nodeId, config })
                      }
                      onAddNode={(type, position) =>
                        addNodeMutation.mutate({
                          type,
                          positionX: position.x,
                          positionY: position.y,
                        })
                      }
                      onAddEdge={(sourceNodeId, targetNodeId) =>
                        addEdgeMutation.mutate({
                          sourceNodeId,
                          targetNodeId,
                        })
                      }
                      onDeleteNode={(nodeId) =>
                        deleteNodeMutation.mutate(nodeId)
                      }
                      onDeleteEdge={(edgeId) =>
                        deleteEdgeMutation.mutate(edgeId)
                      }
                      onSaveLayout={(layout, announce) =>
                        saveLayoutMutation.mutate(
                          layout,
                          announce
                            ? {
                                onSuccess: () =>
                                  toast.success(
                                    "Flow layout saved",
                                    "Node positions are now recorded.",
                                  ),
                                onError: (error) =>
                                  toast.error(
                                    "Flow layout was not saved",
                                    error instanceof Error
                                      ? error.message
                                      : "Try again in a moment.",
                                  ),
                              }
                            : undefined,
                        )
                      }
                    />
                  </Suspense>
                )}
              </div>
            )}
          </div>

          {/* Right: variables, node config, or hint */}
          <div
            ref={rightPanelRef}
            className={`relative flex-none overflow-y-auto border-t border-[#e6dfd8] bg-[#faf9f5] lg:border-l lg:border-t-0 ${
              !showVariables && !selectedNode ? "hidden lg:block" : "block"
            } w-full lg:w-[var(--right-panel-width)]`}
            style={
              {
                "--right-panel-width": `${rightPanelWidth}px`,
              } as CSSProperties
            }
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
              className="absolute left-0 top-0 z-10 hidden h-full w-1.5 cursor-col-resize transition-colors hover:bg-[#cc785c]/30 active:bg-[#cc785c]/50 lg:block"
            />
            <div className="p-4">
              {showVariables ? (
                flowData && (
                  <Suspense
                    fallback={
                      <p role="status" className="text-sm text-[#8e8b82]">
                        Loading variables…
                      </p>
                    }
                  >
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
                  </Suspense>
                )
              ) : selectedNode && flowData ? (
                <Suspense
                  fallback={
                    <p role="status" className="text-sm text-[#8e8b82]">
                      Loading step settings…
                    </p>
                  }
                >
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
                </Suspense>
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
