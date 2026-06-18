import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/next';
import { hasClerk } from '../lib/config';

export const metadata = {
  title: 'Yacht Uniform Lookbook',
  description:
    'Interactive yacht crew uniform configurator — build looks, manage crew sizing, plan budgets, and export procurement-ready lookbooks.',
};

// Brand the hosted Clerk widgets so the first screen every persona sees reads as
// "Yacht Uniform Lookbook" rather than the raw Clerk instance name.
const clerkAppearance = {
  variables: {
    colorPrimary: '#0a2540',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorBackground: '#ffffff',
    colorInputBackground: '#f7f9fc',
    borderRadius: '12px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
  elements: {
    card: { boxShadow: '0 12px 40px rgba(10,37,64,.14)' },
    headerTitle: { fontWeight: 800 },
    logoBox: { display: 'none' },
  },
};

export default function RootLayout({ children }) {
  const body = (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
  return hasClerk
    ? <ClerkProvider appearance={clerkAppearance}>{body}</ClerkProvider>
    : body;
}
