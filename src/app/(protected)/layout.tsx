import Header from '@/components/header';
import Footer from '@/components/footer';
import { AppProviders } from '@/components/app-providers';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppProviders>
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AppProviders>
  );
}
