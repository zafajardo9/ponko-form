import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute, Link } from '@tanstack/react-router'
import { redirectAuthenticatedUser, safeAuthReturnTo } from '../lib/server-fns/auth'

export const Route = createFileRoute('/sign-in/$')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_url: safeAuthReturnTo(search.redirect_url),
  }),
  beforeLoad: ({ search }) => redirectAuthenticatedUser({ data: { returnTo: search.redirect_url } }),
  component: Page,
})

const signInAppearance = {
  elements: {
    card: 'rounded-md border border-[#e6dfd8] bg-white shadow-none',
    headerTitle: 'text-[#141413]',
    headerSubtitle: 'text-[#6c6a64]',
    formFieldInput: 'rounded-md border border-[#e6dfd8] bg-white text-[#141413] focus:ring-[#cc785c] focus:border-[#cc785c]',
    formButtonPrimary:
      'rounded-md bg-[#cc785c] hover:bg-[#a9583e] border-none shadow-none',
    formFieldLabel: 'text-[#141413]',
    footerActionLink: 'text-[#cc785c] hover:text-[#a9583e]',
    socialButtonsBlockButton:
      'rounded-md border border-[#e6dfd8] bg-white text-[#141413] hover:bg-[#faf9f5] shadow-none',
    socialButtonsBlockButtonText: 'font-medium',
    dividerLine: 'bg-[#e6dfd8]',
    dividerText: 'text-[#6c6a64]',
  },
};

function Page() {
  const { redirect_url } = Route.useSearch()
  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#faf9f5]">
      {/* Branding panel — hidden on small screens */}
      <aside className="hidden flex-col justify-between bg-[#181715] p-12 lg:flex lg:w-[400px] xl:w-[460px] flex-none">
        <div>
          <a href="/" className="flex items-center gap-2 mb-12">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#cc785c] text-sm font-bold text-white">
              P
            </span>
            <span className="text-base font-semibold text-[#faf9f5]">PonkoForm</span>
          </a>

          <h2
            className="mb-4 text-3xl font-normal leading-snug text-[#faf9f5]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Welcome back
          </h2>
          <p className="text-[#a09d96] leading-relaxed">
            Sign in to access your forms, view responses, and manage payment integrations.
          </p>
        </div>

        <ul className="space-y-4">
          {[
            'Drag-and-drop form builder',
            'Live preview as you build',
            'PayPal & Xendit payments',
            'Real-time response tracking',
          ].map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-[#a09d96]">
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#cc785c]/20 text-[#cc785c]">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {item}
            </li>
          ))}
        </ul>
      </aside>

      {/* Clerk widget — explicit routing props bypass auto-detection */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="text-sm text-[#6c6a64]">
          Don't have an account?{' '}
          <Link
            to="/sign-up/$"
            params={{ _splat: '' }}
            search={{ redirect_url }}
            className="font-medium text-[#cc785c] hover:text-[#a9583e]"
          >
            Create one free
          </Link>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          forceRedirectUrl={redirect_url}
          appearance={signInAppearance}
        />
      </div>
    </div>
  )
}
