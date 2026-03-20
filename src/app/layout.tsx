import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://pbc-estimate-ai.vercel.app'),
  title: 'PBC Estimate AI | Professional Painting Quotes',
  description:
    'Generate accurate, AI-powered painting estimates for your home or office in seconds with PBC Estimate AI.',
  openGraph: {
    title: 'PBC Estimate AI | Professional Painting Quotes',
    description:
      'Get an instant, data-driven painting cost estimate from the experts at Paint Buddy & Co.',
    url: 'https://pbc-estimate-ai.vercel.app',
    siteName: 'PBC Estimate AI',
    locale: 'en_AU',
    images: [
      {
        url: '/PBCLOGO-Letter-removebg-preview.png',
        width: 1200,
        height: 630,
        alt: 'PBC Estimate AI - AI Painting Estimate',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PBC Estimate AI | Professional Painting Quotes',
    description: 'Instant AI-powered painting estimates for Australian homes and offices.',
    images: ['/PBCLOGO-Letter-removebg-preview.png'],
  },
  icons: {
    shortcut: '/logo-bg-remove.png',
    icon: '/logo-bg-remove.png',
    apple: '/logo-bg-remove.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={cn(inter.variable, 'font-body antialiased h-full')}>{children}</body>
    </html>
  );
}
