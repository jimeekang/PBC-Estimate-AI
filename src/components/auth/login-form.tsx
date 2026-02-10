
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
      // AuthProvider handles redirection
    } catch (e: any) {
      console.error("Google Sign-In Error Catch:", e);
      
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '현재 도메인';
      let errorMessage = [`오류 발생: ${e.message}`];
      
      if (e.code === 'auth/popup-closed-by-user') {
        errorMessage = [
          '로그인 창이 자동으로 닫혔습니다. 다음을 확인해 주세요:',
          '1. 브라우저 설정에서 "서드파티 쿠키 차단"을 해제해 주세요. (가장 흔한 원인)',
          '2. 주소창 오른쪽의 "팝업 차단" 아이콘을 눌러 항상 허용을 선택해 주세요.',
          '3. 시크릿 창(Incognito)에서는 작동하지 않을 수 있습니다.',
          '4. 등록된 도메인 확인:',
          `👉 ${currentDomain}`
        ];
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMessage = [
          '승인되지 않은 도메인입니다. Firebase 콘솔에 아래 주소를 등록해 주세요:',
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
          팝업이 즉시 닫힌다면 브라우저 설정에서 <b>서드파티 쿠키 허용</b>을 확인해 주세요.
        </AlertDescription>
      </Alert>
    </div>
  );
}
