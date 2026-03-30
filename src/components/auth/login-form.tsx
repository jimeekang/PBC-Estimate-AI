'use client';

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { AlertCircle, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  auth,
  isFirebaseConfigured,
  refreshAppCheckToken,
  signInWithGoogle,
} from '@/lib/firebase';

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={isPending}>
      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Sign In
    </Button>
  );
}

function getFirebaseError(error: unknown) {
  return error instanceof FirebaseError ? error : null;
}

export function LoginForm() {
  const [errors, setErrors] = useState<Record<string, string[] | undefined> | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const router = useRouter();

  const signInWithEmail = async (email: string, password: string) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      const firebaseError = getFirebaseError(error);

      if (firebaseError?.code === 'auth/firebase-app-check-token-is-invalid') {
        await refreshAppCheckToken();
        return signInWithEmailAndPassword(auth, email, password);
      }

      throw error;
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) {
      setErrors({ _form: ['Firebase configuration is missing. Please check App Hosting environment variables.'] });
      return;
    }

    try {
      setIsGooglePending(true);
      setErrors(null);
      const result = await signInWithGoogle();

      if (result) {
        router.replace('/estimate');
      }
    } catch (error: unknown) {
      const firebaseError = getFirebaseError(error);
      console.error('Google Sign-In Error:', error);

      if (error instanceof Error && error.message.includes('Local App Check debug token is not registered')) {
        setErrors({ _form: [error.message] });
        return;
      }

      const currentDomain =
        typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      let errorMessage = [
        `Error: ${error instanceof Error ? error.message : 'Unknown sign-in error.'}`,
      ];

      if (firebaseError?.code === 'auth/popup-closed-by-user') {
        errorMessage = [
          'The login window was closed. Please check the following:',
          '1. Disable "Block third-party cookies" in your browser settings.',
          '2. Allow popups for this site in your browser.',
          '3. Incognito mode might interfere with the login process.',
          '4. Ensure the domain is authorized:',
          `-> ${currentDomain}`,
        ];
      } else if (
        firebaseError?.code === 'auth/popup-blocked' ||
        firebaseError?.code === 'auth/internal-error'
      ) {
        errorMessage = [
          'Google popup could not complete, so redirect sign-in will be attempted instead.',
          'If you return here without signing in, allow popups and third-party cookies for localhost and try once more.',
        ];
      } else if (firebaseError?.code === 'auth/unauthorized-domain') {
        errorMessage = [
          'This domain is not authorized. Please add the following address to Firebase Console > Authentication > Settings > Authorized domains:',
          `-> ${currentDomain}`,
          'Or use your Firebase App Hosting production URL.',
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

    if (!isFirebaseConfigured) {
      setIsPending(false);
      setErrors({
        _form: ['Firebase configuration is missing. Please check App Hosting environment variables.'],
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email) {
      setIsPending(false);
      setErrors({ email: ['Email is required.'] });
      return;
    }

    if (!password) {
      setIsPending(false);
      setErrors({ password: ['Password is required.'] });
      return;
    }

    try {
      const userCredential = await signInWithEmail(email, password);
      const user = userCredential.user;
      await user.reload();

      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user);
        } catch (mailError) {
          console.error('Mail send error:', mailError);
        }

        await auth.signOut();
        setIsPending(false);
        setErrors({
          _form: [
            'Email verification is required. A verification email has been sent. Please check your inbox and log in again.',
          ],
        });
        return;
      }

      router.replace('/estimate');
    } catch (error: unknown) {
      const firebaseError = getFirebaseError(error);
      setIsPending(false);
      console.error('Email Login Error:', error);

      if (error instanceof Error && error.message.includes('Local App Check debug token is not registered')) {
        setErrors({ _form: [error.message] });
        return;
      }

      if (firebaseError?.code === 'auth/invalid-credential') {
        setErrors({ _form: ['Invalid email or password.'] });
        return;
      }

      setErrors({ _form: ['An unexpected error occurred during login.'] });
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
              <Link
                href="/forgot-password"
                title="Go to password reset page"
                className="font-medium text-primary hover:underline"
              >
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
              <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
                {errors._form.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
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

      <Button
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isGooglePending}
      >
        {isGooglePending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 h-4 w-4" />
        )}
        Google
      </Button>

      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-muted-foreground">
          If you are using an in-app browser (e.g. Kakao, LINE) and login fails, please open this
          link in <b>Chrome</b> or <b>Safari</b>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
