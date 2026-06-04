import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createStart } from "@tanstack/react-start";

// Register payment gateways on the server only. This module transitively
// imports drizzle/pg, which cannot run in the browser, so the SSR guard
// keeps it out of the client bundle.
if (import.meta.env.SSR) {
  import('./integrations/payments/index');
}

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [clerkMiddleware()],
  };
});
