/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, User, DollarSign, ArrowRight } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

export default function HomePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This code runs only on the client
    setIsClient(true);
    if (auth) { // auth is only available on the client
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          router.push('/dashboard');
        }
      });
      return () => unsubscribe();
    }
  }, [router]);

  // Render a loading state or nothing on the server and initial client render
  if (!isClient) {
    return null;
  }

  // Render the actual content only on the client
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-12 text-center">
        <header className="space-y-4">
          <Image
            src="/logo-bg-remove.png"
            alt="Paint Buddy & Co Logo"
            width={120}
            height={120}
            className="mx-auto shadow-sm rounded-full"
          />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight">
            Welcome to <span className="text-primary">PBC Estimate AI</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            The smartest and fastest way to get a professional painting quote for
            your property, powered by Paint Buddy & Co.
          </p>
        </header>

        <main>
          <div className="mt-10">
            <Button
              onClick={() => router.push('/login')}
              size="lg"
              className="w-full max-w-xs mx-auto shadow-lg transform hover:scale-105 transition duration-300 ease-in-out"
            >
              Get Started for Free
              <ArrowRight className="ml-2 -mr-1 h-5 w-5" />
            </Button>
          </div>

          <div className="mt-20">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="text-left hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Data-Driven Estimates
                  </CardTitle>
                  <BarChart className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Accurate Pricing</div>
                  <p className="text-xs text-gray-500">
                    Based on thousands of real-world projects.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    User-Friendly
                  </CardTitle>
                  <User className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Simple Interface</div>
                  <p className="text-xs text-gray-500">
                    Get your quote in just a few easy steps.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-left hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Completely Free
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">No Hidden Costs</div>
                  <p className="text-xs text-gray-500">
                    Our estimation tool is 100% free to use.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
