import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupForm } from '@/components/auth/signup-form';
import type { Metadata } from 'next';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
    title: 'Create an Account | EstimateAI Painter',
};

export default function SignupPage() {
  return (
    <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-8">
      <div className="text-center">
            <Logo className="justify-center mb-4 text-2xl"/>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Create a new account
            </h2>
            <p className="mt-2 text-muted-foreground">
                to get started with your first estimate
            </p>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Enter your details to create an account.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
