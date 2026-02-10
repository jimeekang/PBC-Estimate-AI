'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { Icons } from '@/components/icons';
import { useRouter } from 'next/navigation';

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
  const [isGooglePending, setIsGooglePending] = useState(false);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    try {
      setIsGooglePending(true);
      setErrors(null);
      await signInWithGoogle();
    } catch (e: any) {
      console.error("Google Sign-In Error:", e);
      
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      let errorMessage = [`Error: ${e.message}`];
      
      if (e.code === 'auth/popup-closed-by-user') {
        errorMessage = [
          'The login window was closed. Please check the following:',
          '1. Disable "Block third-party cookies" in your browser settings.',
          '2. Allow popups for this site in your browser.',
          '3. Incognito mode might interfere with the login process.',
          '4. Ensure the domain is authorized:',
          `👉 ${currentDomain}`
        ];
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMessage = [
          'This domain is not authorized. Please add the following address to Firebase Console:',
          `👉 ${currentDomain}`
        ];
      }
      
      setErrors({ _form: errorMessage });
    } finally {
      setIsGooglePending(false);
    }
  };

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
        try {
          await sendEmailVerification(user);
        } catch (mailError) {
          console.error("Mail send error:", mailError);
        }
        await auth.signOut();
        setIsPending(false);
        return setErrors({ _form: ['Email verification is required. A verification email has been sent. Please check your inbox and log in again.'] });
      }
    } catch (e: any) {
      setIsPending(false);
      console.error("Email Login Error:", e);
      if (e.code === 'auth/invalid-credential') {
        return setErrors({ _form: ['Invalid email or password.'] });
      }
      return setErrors({ _form: ['An unexpected error occurred during login.'] });
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
              <Link href="/forgot-password" title="Go to password reset page" className="font-medium text-primary hover:underline">
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
            <AlertTitle>Login Error</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-xs mt-2">
                {errors._form.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <SubmitButton isPending={isPending} />
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

      <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isGooglePending}>
        {isGooglePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icons.google className="mr-2 h-4 w-4" />}
        Google
      </Button>

      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-muted-foreground">
          If the popup closes immediately, please <b>allow third-party cookies</b> in your browser settings.
        </AlertDescription>
      </Alert>
    </div>
  );
}
