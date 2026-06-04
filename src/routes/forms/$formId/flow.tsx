import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The Flow builder has been merged into the unified editor at
 * `/forms/$formId/edit` (which has a List ⇄ Canvas toggle). This route now
 * redirects there so existing links and bookmarks keep working.
 */
export const Route = createFileRoute("/forms/$formId/flow")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/forms/$formId/edit",
      params: { formId: params.formId },
    });
  },
});
