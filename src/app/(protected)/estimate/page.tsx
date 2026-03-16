'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const EstimateForm = dynamic(
  () => import('@/components/estimate/estimate-form').then((mod) => mod.EstimateForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    ),
  }
);

export default function EstimatePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          New Painting Estimate
        </h1>
        <p className="text-lg text-muted-foreground">
          Please fill out the details below to receive a rough price estimate.
        </p>
      </div>
      <EstimateForm />
    </div>
  );
}
