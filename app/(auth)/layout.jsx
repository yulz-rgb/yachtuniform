import { ClerkProvider } from '@clerk/nextjs';
import { hasClerk } from '../../lib/config';
import { clerkAppearance } from '../../lib/clerkAppearance';

// Clerk is scoped to authenticated routes only (/workspace, /sign-in, /sign-up).
// Public routes such as /demo stay Clerk-free so automated reviewers can load them
// without development-instance browser checks.
export default function AuthLayout({ children }) {
  if (!hasClerk) return children;
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInFallbackRedirectUrl="/workspace"
      signUpFallbackRedirectUrl="/workspace"
    >
      {children}
    </ClerkProvider>
  );
}
