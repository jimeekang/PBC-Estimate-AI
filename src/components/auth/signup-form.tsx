'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={isPending}>
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Create Account
    </Button>
  );
}

export function SignupForm() {
  const [errors, setErrors] = useState<{ [key: string]: string[] | undefined } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setErrors(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setIsPending(false);
      return setErrors({ email: ['Please enter a valid email address.'] });
    }

    if (!password || password.length < 6) {
      setIsPending(false);
      return setErrors({ password: ['Password must be at least 6 characters long.'] });
    }

    if (password !== confirmPassword) {
      setIsPending(false);
      return setErrors({ confirmPassword: ["Passwords don't match"] });
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      window.location.href = '/verify-email';
    } catch (e: any) {
      setIsPending(false);
      if (e.code === 'auth/email-already-in-use') {
        return setErrors({ email: ['Email already in use.'] });
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
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
        {errors?.password && (
          <p className="text-sm text-destructive">{errors.password.join(', ')}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />
         {errors?.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.join(', ')}</p>
        )}
      </div>

      {errors?._form && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Signup Failed</AlertTitle>
            <AlertDescription>{errors._form.join(', ')}</AlertDescription>
        </Alert>
      )}

      <div>
        <SubmitButton isPending={isPending} />
      </div>
    </form>
  );
}
