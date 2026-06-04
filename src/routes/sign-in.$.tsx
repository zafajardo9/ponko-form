import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-in/$')({
  component: Page,
})

function Page() {
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
          <a href="/sign-up/" className="font-medium text-[#cc785c] hover:text-[#a9583e]">
            Create one free
          </a>
        </div>
        <SignIn routing="path" path="/sign-in" />
      </div>
    </div>
  )
}
