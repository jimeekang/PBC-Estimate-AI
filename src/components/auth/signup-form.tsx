'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, signInWithGoogle } from '@/lib/firebase';
import { PrivacyPolicy } from './privacy-policy';
import { Icons } from '@/components/icons';

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
  const [isGooglePending, setIsGooglePending] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsGooglePending(true);
      setErrors(null);
      await signInWithGoogle();
      // AuthProvider handles redirection
    } catch (e: any) {
      console.error("Google Sign-In Component Error (Signup):", e);
      
      let errorMessage = [`오류 발생: ${e.message}`];
      
      if (e.code === 'auth/popup-closed-by-user') {
        errorMessage = [
          '로그인 팝업이 비정상적으로 닫혔습니다.',
          '브라우저 설정에서 "팝업 및 리디렉션"을 허용하고 광고 차단기를 꺼주세요.'
        ];
      } else if (e.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '현재 도메인';
        errorMessage = [
          '승인되지 않은 도메인입니다.',
          `Firebase 콘솔의 Authorized Domains에 다음 주소를 추가해 주세요:`,
          `${currentDomain}`
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
    const confirmPassword = formData.get('confirmPassword') as string;
    const privacyPolicy = formData.get('privacyPolicy');

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setIsPending(false);
      return setErrors({ email: ['Please enter a valid email address.'] });
    }

    const passwordErrors = [];
    if (password.length < 8) passwordErrors.push('Must be at least 8 characters long.');
    if (!/[A-Z]/.test(password)) passwordErrors.push('Must contain at least one uppercase letter.');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) passwordErrors.push('Must contain at least one special character.');

    if (passwordErrors.length > 0) {
      setIsPending(false);
      return setErrors({ password: passwordErrors });
    }

    if (password !== confirmPassword) {
      setIsPending(false);
      return setErrors({ confirmPassword: ["Passwords don't match"] });
    }

    if (privacyPolicy !== 'on') {
      setIsPending(false);
      return setErrors({ privacyPolicy: ['You must agree to the Privacy Policy.'] });
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
      return setErrors({ _form: ['Failed to send verification email. Please try again later.'] });
    }
  };

  return (
    <div className="space-y-6">
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
          <div className="text-xs text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>At least 8 characters</li>
              <li>At least one uppercase letter</li>
              <li>At least one special character</li>
            </ul>
          </div>
          {errors?.password && (
            <div className="text-sm text-destructive">
              {errors.password.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" required />
          {errors?.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.join(', ')}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="privacy-policy" name="privacyPolicy" />
            <label
              htmlFor="privacy-policy"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I agree to the Privacy Policy
            </label>
            <PrivacyPolicy />
          </div>
          {errors?.privacyPolicy && (
            <p className="text-sm text-destructive">{errors.privacyPolicy.join(', ')}</p>
          )}
        </div>

        {errors?._form && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Signup Status</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-xs">
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
    </div>
  );
}
