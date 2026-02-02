'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={isPending}>
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Sign In
    </Button>
  );
}

export function LoginForm() {
  const [errors, setErrors] = useState<{ [key: string]: string[] | undefined } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setErrors(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email) {
      setIsPending(false);
      return setErrors({ email: ['Email is required.'] });
    }
    if (!password) {
      setIsPending(false);
      return setErrors({ password: ['Password is required.'] });
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user);
        await auth.signOut(); // Log out user until they are verified
        setIsPending(false);
        return setErrors({ _form: ['Please verify your email before logging in. A new verification link has been sent.'] });
      }
      // On success, trigger a full page refresh to navigate.
      window.location.href = '/estimate';
    } catch (e: any) {
      setIsPending(false);
      if (e.code === 'auth/invalid-credential') {
        return setErrors({ _form: ['Invalid email or password.'] });
      }
      return setErrors({ _form: ['An unexpected error occurred. Please try again.'] });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="email@example.com"
        />
        {errors?.email && (
          <p className="text-sm text-destructive">{errors.email.join(', ')}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <div className="text-sm">
            <Link href="#" className="font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <Input id="password" name="password" type="password" required />
         {errors?.password && (
          <p className="text-sm text-destructive">{errors.password.join(', ')}</p>
        )}
      </div>
      
      {errors?._form && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Login Failed</AlertTitle>
            <AlertDescription>{errors._form.join(', ')}</AlertDescription>
        </Alert>
      )}

      <div>
        <SubmitButton isPending={isPending} />
      </div>
    </form>
  );
}
