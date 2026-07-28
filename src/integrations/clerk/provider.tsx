import { ClerkProvider } from "@clerk/tanstack-react-start";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file");
}

const clerkAppearance = {
  variables: {
    colorPrimary: "#cc785c",
    colorBackground: "#faf9f5",
    colorInputBackground: "#ffffff",
    colorInputText: "#141413",
    colorText: "#141413",
    colorTextSecondary: "#6c6a64",
    colorDanger: "#c64545",
    borderRadius: "6px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

interface AppClerkProviderProps {
  children: React.ReactNode;
}

export default function AppClerkProvider({ children }: AppClerkProviderProps) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/sign-in/"
      signUpUrl="/sign-up/"
      signInFallbackRedirectUrl="/forms"
      signUpFallbackRedirectUrl="/forms"
      afterSignOutUrl="/"
      appearance={clerkAppearance}
    >
      {children}
    </ClerkProvider>
  );
}
