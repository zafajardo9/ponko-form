import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { requireAuth } from "@/lib/server-fns/auth";
import {
  bulkDeleteForms,
  bulkUpdateForms,
  deleteForm,
  getForms,
} from "@/lib/server-fns/forms";
import { FormCard } from "@/components/dashboard/FormCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { FormPreviewDialog } from "@/components/dashboard/FormPreviewDialog";
import { ShareDialog } from "@/components/dashboard/ShareDialog";
import { ShareFormDialog } from "@/components/forms/ShareFormDialog";
import { Button } from "@/components/ui/Button";
import {
  AlertCircle,
  CheckSquare2,
  FileCheck2,
  FilePenLine,
  Trash2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/forms/")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: FormsPage,
});

function FormsPage() {
  const queryClient = useQueryClient();
  const [previewFormId, setPreviewFormId] = useState<number | null>(null);
  const [shareFormId, setShareFormId] = useState<number | null>(null);
  const [accessFormId, setAccessFormId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const {
    data: forms = [],
    error: formsError,
    isError: formsFailed,
    isFetching: formsFetching,
    isLoading,
    refetch: refetchForms,
  } = useQuery({
    queryKey: ["forms"],
    queryFn: () => getForms(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteForm({ data: { id } }),
    onSuccess: (_, id) => {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({
      ids,
      status,
    }: {
      ids: number[];
      status: "draft" | "published";
    }) => bulkUpdateForms({ data: { ids, status } }),
    onMutate: () => {
      setBulkMessage(null);
      setBulkError(null);
    },
    onSuccess: (result, variables) => {
      setSelectedIds(new Set());
      setBulkMessage(
        `${result.updated} ${result.updated === 1 ? "form" : "forms"} moved to ${
          variables.status === "published" ? "published" : "drafts"
        }.`,
      );
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (error) => {
      setBulkError(
        error instanceof Error ? error.message : "The selected forms could not be updated.",
      );
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteForms({ data: { ids } }),
    onMutate: () => {
      setBulkMessage(null);
      setBulkError(null);
    },
    onSuccess: (result) => {
      setSelectedIds(new Set());
      setBulkMessage(
        `${result.deleted} ${result.deleted === 1 ? "form" : "forms"} deleted.`,
      );
      queryClient.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (error) => {
      setBulkError(
        error instanceof Error ? error.message : "The selected forms could not be deleted.",
      );
    },
  });

  function handleDelete(id: number) {
    if (confirm("Delete this form? This cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  }

  function setFormSelected(id: number, selected: boolean) {
    setBulkMessage(null);
    setBulkError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll() {
    setBulkMessage(null);
    setBulkError(null);
    const ownedForms = forms.filter((form) => form.accessRole === "owner");
    setSelectedIds((current) =>
      current.size === ownedForms.length
        ? new Set()
        : new Set(ownedForms.map((form) => form.id)),
    );
  }

  const selected = [...selectedIds];
  const ownedFormCount = forms.filter((form) => form.accessRole === "owner").length;
  const allSelected = ownedFormCount > 0 && selectedIds.size === ownedFormCount;
  const bulkPending = bulkStatusMutation.isPending || bulkDeleteMutation.isPending;
  const previewForm = forms.find((form) => form.id === previewFormId);
  const shareForm = forms.find((form) => form.id === shareFormId);
  const accessForm = forms.find((form) => form.id === accessFormId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium text-[#141413]">My Forms</h1>
          <p className="mt-1 text-[#6c6a64]">Create and manage your forms</p>
        </div>
        <Link to="/forms/new">
          <Button>New Form</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[220px] animate-pulse rounded-2xl bg-[#efe9de]"
            />
          ))}
        </div>
      ) : formsFailed ? (
        <div
          role="alert"
          className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-[#e3c5bd] bg-[#fff8f5] px-6 py-10 text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5e4dc] text-[#a9583e]">
            <AlertCircle size={20} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-[#141413]">
            We couldn&apos;t load your forms
          </h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-[#6c6a64]">
            {formsError instanceof Error
              ? formsError.message
              : "Something interrupted the request. Your forms are still safe."}
          </p>
          <Button
            type="button"
            className="mt-5"
            disabled={formsFetching}
            onClick={() => void refetchForms()}
          >
            {formsFetching ? "Trying again…" : "Try again"}
          </Button>
        </div>
      ) : forms.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section
            aria-label="Bulk form actions"
            className={`mb-5 transition-colors ${
              selectedIds.size > 0
                ? "overflow-hidden rounded-2xl bg-[#24221f] text-white shadow-[0_12px_32px_rgba(20,20,19,0.14)]"
                : "px-1"
            }`}
          >
            {selectedIds.size === 0 ? (
              <div className="flex min-h-9 items-center justify-between gap-3">
                <p className="text-sm text-[#817d76]">
                  {forms.length} {forms.length === 1 ? "form" : "forms"}
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#6c6a64] transition-colors hover:bg-[#f3eee6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
                >
                  <CheckSquare2 size={16} aria-hidden="true" />
                  Select all
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#cc785c] text-white">
                    <CheckSquare2 size={16} aria-hidden="true" />
                  </span>
                  <p className="truncate text-sm text-[#d8d3cc]" aria-live="polite">
                    <span className="font-semibold text-white">{selectedIds.size}</span>
                    {` of ${forms.length} selected`}
                  </p>
                  {!allSelected ? (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="shrink-0 text-xs font-medium text-[#e3a893] underline-offset-4 hover:text-[#f1c4b4] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
                    >
                      Select all
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-2 !border-[#4a4640] !bg-[#35322e] !text-white hover:!bg-[#45413b]"
                    onClick={() =>
                      bulkStatusMutation.mutate({ ids: selected, status: "published" })
                    }
                    disabled={bulkPending}
                  >
                    <FileCheck2 size={15} aria-hidden="true" />
                    Publish
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-2 !border-[#4a4640] !bg-[#35322e] !text-white hover:!bg-[#45413b]"
                    onClick={() =>
                      bulkStatusMutation.mutate({ ids: selected, status: "draft" })
                    }
                    disabled={bulkPending}
                  >
                    <FilePenLine size={15} aria-hidden="true" />
                    Move to drafts
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="gap-2"
                    onClick={() => {
                      const count = selectedIds.size;
                      if (
                        confirm(
                          `Delete ${count} selected ${count === 1 ? "form" : "forms"}? This cannot be undone.`,
                        )
                      ) {
                        bulkDeleteMutation.mutate(selected);
                      }
                    }}
                    disabled={bulkPending}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Delete
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={bulkPending}
                    aria-label="Clear form selection"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#aaa39a] transition-colors hover:bg-[#35322e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] disabled:opacity-50"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {bulkMessage ? (
            <p className="mb-4 text-sm font-medium text-[#2d7a3e]" role="status">
              {bulkMessage}
            </p>
          ) : null}
          {bulkError ? (
            <p className="mb-4 text-sm font-medium text-[#b33e35]" role="alert">
              {bulkError}
            </p>
          ) : null}

          <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onDelete={handleDelete}
                onPreview={(id) => setPreviewFormId(id)}
                onShare={(id) => setShareFormId(id)}
                onManageAccess={(id) => setAccessFormId(id)}
                selected={selectedIds.has(form.id)}
                onSelectionChange={setFormSelected}
              />
            ))}
          </div>
        </>
      )}

      {previewFormId != null && previewForm && (
        <FormPreviewDialog
          formId={previewForm.id}
          title={previewForm.title}
          onClose={() => setPreviewFormId(null)}
        />
      )}

      {shareFormId != null && shareForm?.publicId && (
        <ShareDialog
          publicId={shareForm.publicId}
          title={shareForm?.title ?? "Form"}
          onClose={() => setShareFormId(null)}
        />
      )}
      {accessFormId != null && accessForm?.accessRole === "owner" && (
        <ShareFormDialog
          formId={accessForm.id}
          title={accessForm.title}
          open
          onClose={() => setAccessFormId(null)}
        />
      )}
    </div>
  );
}
