import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Show, UserButton } from "@clerk/tanstack-react-start";

import ClerkProvider from "../integrations/clerk/provider";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

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
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider>
          <ChromeNav />
          {children}
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
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Renders the app navigation everywhere except on public-facing form pages
 * (the shareable `/forms/submit/...` page and the embeddable `/forms/embed/...`
 * page), which are shown bare so they can be shared or iframed cleanly.
 */
function ChromeNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublicForm =
    pathname.startsWith("/forms/submit/") ||
    pathname.startsWith("/forms/embed/") ||
    pathname.startsWith("/forms/payment-return");
  if (isPublicForm) return null;
  return <TopNav />;
}

function TopNav() {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center border-b border-[#e6dfd8] bg-[#faf9f5]/95 backdrop-blur-sm px-6">
      <div className="flex w-full max-w-6xl mx-auto items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#cc785c] text-sm font-bold text-white">
              P
            </span>
            <span className="text-base font-semibold text-[#141413] tracking-tight">
              PonkoForm
            </span>
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            <Show when="signed-in">
              <Link
                to="/dashboard"
                className="text-sm text-[#6c6a64] hover:text-[#141413] transition-colors [&.active]:text-[#141413] [&.active]:font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/forms"
                className="text-sm text-[#6c6a64] hover:text-[#141413] transition-colors [&.active]:text-[#141413] [&.active]:font-medium"
              >
                Forms
              </Link>
              <Link
                to="/settings"
                className="text-sm text-[#6c6a64] hover:text-[#141413] transition-colors [&.active]:text-[#141413] [&.active]:font-medium"
              >
                Settings
              </Link>
              <Link
                to="/settings/integrations"
                className="text-sm text-[#6c6a64] hover:text-[#141413] transition-colors [&.active]:text-[#141413] [&.active]:font-medium"
              >
                Integrations
              </Link>
            </Show>
            <Link
              to="/docs"
              className="text-sm text-[#6c6a64] hover:text-[#141413] transition-colors [&.active]:text-[#141413] [&.active]:font-medium"
            >
              Docs
            </Link>
          </nav>
        </div>

        {/* Right side auth — use plain <a> so Clerk sees exact /sign-in path */}
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <a
              href="/sign-in/"
              className="text-sm font-medium text-[#6c6a64] hover:text-[#141413] transition-colors"
            >
              Sign in
            </a>
            <a
              href="/sign-up/"
              className="inline-flex h-9 items-center rounded-md bg-[#cc785c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]"
            >
              Get started free
            </a>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
