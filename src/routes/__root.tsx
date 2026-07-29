import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { lazy, Suspense } from "react";

import { ErrorBoundary } from "../components/layout/ErrorBoundary";
import { ToastProvider } from "../components/ui/Toast";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { isBarePublicPath } from "../lib/public-route";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

const AuthenticatedAppShell = lazy(
  () => import("../components/layout/AuthenticatedAppShell"),
);
const RootErrorPage = lazy(() =>
  import("../components/layout/RouteFailurePage").then((module) => ({
    default: module.RootErrorPage,
  })),
);
const RootNotFoundPage = lazy(() =>
  import("../components/layout/RouteFailurePage").then((module) => ({
    default: module.RootNotFoundPage,
  })),
);

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PonkoForm — Build forms that collect more" },
      {
        name: "description",
        content:
          "Create beautiful forms with drag-and-drop simplicity. Accept payments with PayPal or Xendit.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap",
      },
    ],
  }),
  errorComponent: RootErrorPage,
  notFoundComponent: RootNotFoundPage,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ToastProvider>
          <ApplicationShell>{children}</ApplicationShell>
        </ToastProvider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

function ApplicationShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isBarePublicPath(pathname)) return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<ShellLoading />}>
        <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
      </Suspense>
    </ErrorBoundary>
  )
}

function ShellLoading() {
  return (
    <div
      role="status"
      aria-label="Loading application"
      className="h-16 animate-pulse border-b border-[#e6dfd8] bg-[#faf9f5]"
    />
  )
}
