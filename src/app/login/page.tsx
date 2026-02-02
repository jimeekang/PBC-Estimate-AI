import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';
import type { Metadata } from 'next';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
    title: 'Login | EstimateAI Painter',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
            <Logo className="justify-center mb-4 text-2xl"/>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Sign in to your account
            </h2>
            <p className="mt-2 text-muted-foreground">
                to get your AI-powered painting estimate
            </p>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
