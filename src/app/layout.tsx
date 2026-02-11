import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/providers/auth-provider';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  metadataBase: new URL('https://pbc-estimate-ai.vercel.app'),

  title: 'PBC Estimate AI | Professional Painting Quotes',
  description:
    'Generate accurate, AI-powered painting estimates for your home or office in seconds with PBC Estimate AI.',

  // 🔖 Favicon 설정
  icons: {
    icon: [
      {
        url: '/logo-bg-remove.png',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/logo-bg-remove.png',
        type: 'image/png',
      },
    ],
  },

  // 🌐 Open Graph (카카오톡 / WhatsApp / Facebook / iMessage)
  openGraph: {
    title: 'PBC Estimate AI | Professional Painting Quotes',
    description:
      'Get an instant, data-driven painting cost estimate from the experts at Paint Buddy & Co.',
    siteName: 'PBC Estimate AI',
    locale: 'en_AU',
    type: 'website',
    images: [
      {
        url: '/PBCLOGO-Letter-removebg-preview.png',
        width: 1200,
        height: 630,
        alt: 'PBC Estimate AI – AI Painting Estimate',
      },
    ],
  },

  // 🐦 Twitter(X) 카드
  twitter: {
    card: 'summary_large_image',
    title: 'PBC Estimate AI | Professional Painting Quotes',
    description:
      'Instant AI-powered painting estimates for Australian homes and offices.',
    images: ['/PBCLOGO-Letter-removebg-preview.png'],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('font-body antialiased h-full')}>
        <AuthProvider>
          <div className="flex flex-col min-h-full">
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
