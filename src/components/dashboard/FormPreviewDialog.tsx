import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { getEditorForm } from "@/lib/server-fns/forms";
import { themeVars, type FormTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { PreviewDialog } from "@/components/ui/PreviewDialog";

const PageFormView = lazy(() =>
  import("@/components/page-form/PageFormView").then((module) => ({
    default: module.PageFormView,
  })),
);

const FlowPreviewModal = lazy(() =>
  import("@/components/ui/FlowPreviewModal").then((module) => ({
    default: module.FlowPreviewModal,
  })),
);

interface FormPreviewDialogProps {
  formId: number;
  title: string;
  onClose: () => void;
}

export function FormPreviewDialog({
  formId,
  title,
  onClose,
}: FormPreviewDialogProps) {
  const previewQuery = useQuery({
    queryKey: ["form-preview", formId],
    queryFn: () => getEditorForm({ data: { formId } }),
    retry: 1,
  });

  const editorData = previewQuery.data;
  const form = editorData?.form;
  const pageForm = editorData?.pageForm;
  const flow = editorData?.flow;

  return (
    <PreviewDialog title={form?.title ?? title} onClose={onClose}>
      {previewQuery.isLoading ? (
        <PreviewLoading />
      ) : previewQuery.isError ? (
        <div
          role="alert"
          className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-[#e3c5bd] bg-[#fff8f5] px-6 py-10 text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5e4dc] text-[#a9583e]">
            <AlertCircle size={20} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[#141413]">
            Preview couldn&apos;t be loaded
          </h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-[#6c6a64]">
            Your form is still safe. Check your connection and try again.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-5"
            disabled={previewQuery.isFetching}
            onClick={() => void previewQuery.refetch()}
          >
            {previewQuery.isFetching ? "Trying again…" : "Try again"}
          </Button>
        </div>
      ) : (
        <div
          key={formId}
          style={themeVars((form?.theme as FormTheme | null) ?? null)}
          className="rounded-xl bg-[var(--ponko-bg,#faf9f5)] p-3 sm:p-6"
        >
          <Suspense fallback={<PreviewLoading />}>
            {pageForm ? (
              <PageFormView
                title={form?.title ?? title}
                description={form?.description}
                pages={pageForm.pages}
                references={pageForm.references ?? []}
                recaptchaSiteKey={pageForm.recaptchaSiteKey}
                theme={(form?.theme as FormTheme | null) ?? null}
                preview
              />
            ) : flow ? (
              <FlowPreviewModal
                nodes={flow.nodes}
                edges={flow.edges}
                variables={flow.variables}
              />
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <h2 className="text-base font-semibold text-[#141413]">
                  Nothing to preview yet
                </h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-[#6c6a64]">
                  Add and save a page or flow in the builder, then preview it here.
                </p>
              </div>
            )}
          </Suspense>
        </div>
      )}
    </PreviewDialog>
  );
}

function PreviewLoading() {
  return (
    <div
      role="status"
      className="min-h-64 animate-pulse rounded-xl bg-[#efe9de]"
    >
      <span className="sr-only">Loading preview…</span>
    </div>
  );
}
