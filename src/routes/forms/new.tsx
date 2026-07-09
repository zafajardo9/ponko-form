import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { requireAuth } from "../../lib/server-fns/auth";
import { createForm } from "../../lib/server-fns/forms";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";

export const Route = createFileRoute("/forms/new")({
  beforeLoad: () => requireAuth(),
  component: NewFormPage,
});

function NewFormPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Form title is required");
      return;
    }
    setLoading(true);
    try {
      const form = await createForm({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
        },
      });
      // New forms open in the page builder with Page 1 and a final thank-you page.
      navigate({ to: "/forms/$formId/edit", params: { formId: String(form.id) } });
    } catch {
      setError("Failed to create form. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-medium text-[#141413]">Create a new form</h1>
        <p className="mt-2 text-[#6c6a64]">
          Give your form a name, then add pages and fields in the editor.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Input
            label="Form title"
            placeholder="e.g. Event Registration"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            error={error}
            required
            autoFocus
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#141413]">
              Description <span className="text-[#8e8b82]">(optional)</span>
            </label>
            <textarea
              placeholder="What is this form for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create & open editor"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => history.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
