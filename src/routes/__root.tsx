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
import { isBarePublicPath, isEmbeddableFormPath } from "../lib/public-route";
import { appConfig } from "../utils/app-config";

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
      { name: "theme-color", content: "#faf9f5" },
      { title: `${appConfig.name} — Build forms that collect more` },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Embedded forms live in a host site's <iframe>: keep the document canvas
  // transparent there so the host background shows through around the form,
  // and only the form container's own theme color paints.
  const canvasColor = isEmbeddableFormPath(pathname) ? "transparent" : "#faf9f5";
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ backgroundColor: canvasColor }}
    >
      <head>
        <HeadContent />
      </head>
      <body style={{ margin: 0, backgroundColor: canvasColor }}>
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
        <AuthenticatedAppShell>
          <div className="t-route-page">{children}</div>
        </AuthenticatedAppShell>
      </Suspense>
    </ErrorBoundary>
  )
}

function ShellLoading() {
  return (
    <div
      role="status"
      aria-label="Loading application"
      className="min-h-dvh bg-[#faf9f5]"
    >
      <div className="h-16 animate-pulse border-b border-[#e6dfd8] bg-[#faf9f5] motion-reduce:animate-none" />
    </div>
  )
}
