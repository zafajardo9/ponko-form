import { SignUp } from '@clerk/tanstack-react-start'
import { createFileRoute, Link } from '@tanstack/react-router'
import { redirectAuthenticatedUser, safeAuthReturnTo } from '../lib/server-fns/auth'

export const Route = createFileRoute('/sign-up/$')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_url: safeAuthReturnTo(search.redirect_url),
  }),
  beforeLoad: ({ search }) => redirectAuthenticatedUser({ data: { returnTo: search.redirect_url } }),
  component: Page,
})

const signUpAppearance = {
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
      <aside className="hidden flex-col justify-between bg-[#cc785c] p-12 lg:flex lg:w-[400px] xl:w-[460px] flex-none">
        <div>
          <a href="/" className="flex items-center gap-2 mb-12">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white">
              P
            </span>
            <span className="text-base font-semibold text-white">PonkoForm</span>
          </a>

          <h2
            className="mb-4 text-3xl font-normal leading-snug text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Start collecting responses today
          </h2>
          <p className="text-[#f5ddd5] leading-relaxed">
            Build your first form in minutes. No credit card required — it's completely free to get
            started.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-white/15 px-5 py-4">
            <p className="text-2xl font-semibold text-white">∞</p>
            <p className="text-sm text-[#f5ddd5]">Forms you can create</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/15 px-4 py-3">
              <p className="text-xl font-semibold text-white">7+</p>
              <p className="text-xs text-[#f5ddd5]">Field types</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-3">
              <p className="text-xl font-semibold text-white">2</p>
              <p className="text-xs text-[#f5ddd5]">Payment gateways</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Clerk widget — explicit routing props bypass auto-detection */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="text-sm text-[#6c6a64]">
          Already have an account?{' '}
          <Link
            to="/sign-in/$"
            params={{ _splat: '' }}
            search={{ redirect_url }}
            className="font-medium text-[#cc785c] hover:text-[#a9583e]"
          >
            Sign in
          </Link>
        </div>
        <SignUp
          routing="path"
          path="/sign-up"
          forceRedirectUrl={redirect_url}
          appearance={signUpAppearance}
        />
      </div>
    </div>
  )
}
