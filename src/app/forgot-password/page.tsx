'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Logo } from '@/components/logo';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsPending(true);
    setStatus(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus({
        type: 'success',
        message: 'Password reset email has been sent. Please check your inbox.',
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      let message = 'An error occurred. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email address.';
      }
      setStatus({ type: 'error', message });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="justify-center mb-4 text-2xl" />
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Reset your password
          </h2>
          <p className="mt-2 text-muted-foreground">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Forgot Password</CardTitle>
            <CardDescription>
              We will send a password reset link to your registered email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {status && (
                <Alert variant={status.type === 'error' ? 'destructive' : 'default'} className={status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}>
                  {status.type === 'error' ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <AlertTitle>{status.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
                  <AlertDescription>{status.message}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
