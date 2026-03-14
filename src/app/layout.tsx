import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/providers/auth-provider';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Toaster } from '@/components/ui/toaster';

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
      <body className={cn('font-body antialiased h-full')}>
        <AuthProvider>
          <div className="flex min-h-full flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
