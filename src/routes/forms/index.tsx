import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { requireAuth } from "../../lib/server-fns/auth";
import { getForms, deleteForm } from "../../lib/server-fns/forms";
import { FormCard } from "../../components/dashboard/FormCard";
import { EmptyState } from "../../components/dashboard/EmptyState";
import { ShareDialog } from "../../components/dashboard/ShareDialog";
import { Button } from "../../components/ui/Button";

export const Route = createFileRoute("/forms/")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: FormsPage,
});

function FormsPage() {
  const queryClient = useQueryClient();
  const [shareFormId, setShareFormId] = useState<number | null>(null);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["forms"],
    queryFn: () => getForms(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteForm({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  });

  function handleDelete(id: number) {
    if (confirm("Delete this form? This cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  }

  const shareForm = (forms as any[]).find((f: any) => f.id === shareFormId);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium text-[#141413]">My Forms</h1>
          <p className="mt-1 text-[#6c6a64]">Create and manage your forms</p>
        </div>
        <Link to="/forms/new">
          <Button>New Form</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-[#efe9de]"
            />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(forms as any[]).map((form) => (
            <FormCard
              key={form.id}
              form={form}
              onDelete={handleDelete}
              onShare={(id) => setShareFormId(id)}
            />
          ))}
        </div>
      )}

      {shareFormId != null && shareForm?.publicId && (
        <ShareDialog
          publicId={shareForm.publicId}
          title={shareForm?.title ?? "Form"}
          onClose={() => setShareFormId(null)}
        />
      )}
    </div>
  );
}
