
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
      console.log("Starting Google Sign-In Process...");
      const result = await signInWithGoogle();
      if (result?.user) {
        console.log("Google Sign-In Successful for user:", result.user.email);
      }
    } catch (e: any) {
      console.error("Google Sign-In Component Error:", e);
      
      let errorMessage = [`오류 발생: ${e.message}`];
      
      if (e.code === 'auth/popup-closed-by-user') {
        errorMessage = [
          '로그인 팝업창이 닫혔습니다.',
          '1. 직접 창을 닫지 않았다면, 브라우저의 "팝업 차단" 설정을 확인해 주세요.',
          '2. 광고 차단 프로그램(AdBlock 등)이 실행 중이라면 잠시 중지해 주세요.',
          '3. 브라우저 설정에서 "타사 쿠키 허용"이 되어 있는지 확인해 주세요.',
          '4. 계속 실패할 경우 시크릿 모드(Incognito)에서 시도해 보세요.'
        ];
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMessage = [
          '현재 도메인이 Firebase 승인 도메인에 등록되어 있지 않습니다.',
          'Firebase Console -> Authentication -> Settings -> Authorized Domains에 현재 주소를 추가해야 합니다.'
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
        return setErrors({ _form: ['이메일 인증이 필요합니다. 인증 메일이 발송되었습니다. 확인 후 다시 로그인해 주세요.'] });
      }
    } catch (e: any) {
      setIsPending(false);
      console.error("Email Login Error:", e);
      if (e.code === 'auth/invalid-credential') {
        return setErrors({ _form: ['이메일 또는 비밀번호가 올바르지 않습니다.'] });
      }
      return setErrors({ _form: ['로그인 중 예상치 못한 오류가 발생했습니다.'] });
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
            <AlertTitle>로그인 오류</AlertTitle>
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
