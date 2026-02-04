'use client';

import { MailCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/firebase';

export default function VerifyEmailPage() {
  const router = useRouter();

  const handleReturnToLogin = async () => {
    await auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl">Check your email</CardTitle>
          <CardDescription>
            We've sent a verification link to your email address. Please click the link to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleReturnToLogin} className="w-full">
            Return to Login
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Didn't receive an email? Check your spam folder or try signing up again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
