import './globals.css';
import { Inter, Playfair_Display } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { siteConfig } from '../lib/site';
import { ChunkLoadRecovery } from '../components/ChunkLoadRecovery';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata = {
  title: {
    default: `${siteConfig.name} — Yacht Crew Uniform Planning`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className={inter.className}>
        <ChunkLoadRecovery />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
