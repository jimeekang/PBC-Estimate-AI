'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { login } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Sign In
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, { errors: {} });

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
        {state.errors?.email && (
          <p className="text-sm text-destructive">{state.errors.email.join(', ')}</p>
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
         {state.errors?.password && (
          <p className="text-sm text-destructive">{state.errors.password.join(', ')}</p>
        )}
      </div>
      
      {state.errors?._form && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Login Failed</AlertTitle>
            <AlertDescription>{state.errors._form.join(', ')}</AlertDescription>
        </Alert>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
