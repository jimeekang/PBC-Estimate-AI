'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { signup } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useRouter } from 'next/navigation';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Create Account
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState(signup, { errors: {} });
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push('/verify-email');
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
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
        {state?.errors?.email && (
          <p className="text-sm text-destructive">{state.errors.email.join(', ')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
        {state?.errors?.password && (
          <p className="text-sm text-destructive">{state.errors.password.join(', ')}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />
         {state?.errors?.confirmPassword && (
          <p className="text-sm text-destructive">{state.errors.confirmPassword.join(', ')}</p>
        )}
      </div>

      {state?.errors?._form && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Signup Failed</AlertTitle>
            <AlertDescription>{state.errors._form.join(', ')}</AlertDescription>
        </Alert>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
