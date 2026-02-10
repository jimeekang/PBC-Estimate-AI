'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { Icons } from '@/components/icons';

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

  const handleGoogleSignIn = async () => {
    try {
        await signInWithGoogle();
    } catch (e: any) {
        // Don't show an error if the user closes the sign-in popup.
        if (e.code === 'auth/popup-closed-by-user') {
            return;
        }
        console.error("Google Sign-In Error:", e);
        setErrors({ _form: ['An unexpected error occurred with Google Sign-In. Please try again.'] });
    }
  }

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
      const user = userCredential.user;

      await user.reload();

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        await auth.signOut();
        setIsPending(false);
        return setErrors({ _form: ['Please verify your email to log in. We have sent a new verification link to your email address.'] });
      }
    } catch (e: any) {
      setIsPending(false);
      if (e.code === 'auth/invalid-credential') {
        return setErrors({ _form: ['Invalid email or password.'] });
      }
      return setErrors({ _form: ['An unexpected error occurred. Please try again.'] });
    }
  };

  return (
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                Or continue with
                </span>
            </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            <Icons.google className="mr-2 h-4 w-4" />
            Google
        </Button>
    </div>
  );
}
