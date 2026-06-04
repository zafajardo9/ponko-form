import { ClerkProvider } from '@clerk/tanstack-react-start'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error('Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file')
}

interface AppClerkProviderProps {
  children: React.ReactNode
}

export default function AppClerkProvider({ children }: AppClerkProviderProps) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/sign-in/"
      signUpUrl="/sign-up/"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  )
}
