import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { requireAuth } from "../../../lib/server-fns/auth";

export const Route = createFileRoute("/integrations/google/callback")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: GoogleCallbackPage,
});

function GoogleCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: Route.id }) as {
    code?: string;
    provider?: string;
  };
  const [status, setStatus] = useState<"exchanging" | "success" | "error">(
    "exchanging",
  );
  const [message, setMessage] = useState("Completing Google authorization…");

  useEffect(() => {
    if (!search.code) {
      setStatus("error");
      setMessage("No authorization code received.");
      return;
    }

    // Exchange code for tokens via the server function
    import("../../../lib/server-fns/google-oauth").then(
      async ({ handleGoogleCallback }) => {
        try {
          const result = await handleGoogleCallback({
            data: { code: search.code! },
          });
          if (result.success) {
            setStatus("success");
            setMessage("Google Sheets connected successfully!");
          } else {
            setStatus("error");
            setMessage(result.error ?? "Failed to complete authorization.");
          }
        } catch (err) {
          setStatus("error");
          setMessage((err as Error).message ?? "An unexpected error occurred.");
        }
      },
    );
  }, [search.code]);

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <Card className="text-center py-12">
        {status === "exchanging" && (
          <>
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#e6dfd8] border-t-[#cc785c] mx-auto" />
            <h1 className="text-xl font-medium text-[#141413]">Connecting…</h1>
            <p className="mt-2 text-sm text-[#6c6a64]">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mb-4 text-5xl">✅</div>
            <h1 className="text-xl font-medium text-[#141413]">Connected!</h1>
            <p className="mt-2 text-sm text-[#6c6a64]">{message}</p>
            <div className="mt-6">
              <Button
                onClick={() => navigate({ to: "/settings/integrations" })}
              >
                Back to Integrations
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-4 text-5xl">❌</div>
            <h1 className="text-xl font-medium text-[#141413]">
              Connection failed
            </h1>
            <p className="mt-2 text-sm text-[#c64545]">{message}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate({ to: "/settings/integrations" })}
              >
                Back
              </Button>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
