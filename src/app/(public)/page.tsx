import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicAuthRedirect } from '@/components/public-auth-redirect';
import { ArrowRight, BarChart3, DollarSign, User } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <PublicAuthRedirect />
      <div className="w-full max-w-4xl space-y-12 text-center">
        <header className="space-y-4">
          <Image
            src="/logo-bg-remove.png"
            alt="Paint Buddy & Co Logo"
            width={120}
            height={120}
            className="mx-auto rounded-full shadow-sm"
            priority
          />
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to <span className="text-primary">PBC Estimate AI</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-gray-500">
            The smartest and fastest way to get a professional painting quote for your property,
            powered by Paint Buddy & Co.
          </p>
        </header>

        <main>
          <div className="mt-10">
            <Button asChild size="lg" className="mx-auto w-full max-w-xs shadow-lg">
              <Link href="/login">
                Get Started for Free
                <ArrowRight className="ml-2 -mr-1 h-5 w-5" />
              </Link>
            </Button>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="text-left transition-shadow duration-300 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Data-Driven Estimates
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Accurate Pricing</div>
                <p className="text-xs text-gray-500">Based on thousands of real-world projects.</p>
              </CardContent>
            </Card>

            <Card className="text-left transition-shadow duration-300 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">User-Friendly</CardTitle>
                <User className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Simple Interface</div>
                <p className="text-xs text-gray-500">Get your quote in just a few easy steps.</p>
              </CardContent>
            </Card>

            <Card className="text-left transition-shadow duration-300 hover:shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Completely Free</CardTitle>
                <DollarSign className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">No Hidden Costs</div>
                <p className="text-xs text-gray-500">Our estimation tool is 100% free to use.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
