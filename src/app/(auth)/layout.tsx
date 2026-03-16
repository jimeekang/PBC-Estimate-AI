import { AppProviders } from '@/components/app-providers';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppProviders>{children}</AppProviders>;
}
