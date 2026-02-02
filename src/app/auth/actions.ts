'use server';

import { auth } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const signupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters long.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export async function signup(prevState: any, formData: FormData) {
  const result = signupSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { email, password } = result.data;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      return { errors: { email: ['Email already in use.'] } };
    }
    return { errors: { _form: ['An unexpected error occurred. Please try again.'] } };
  }

  redirect('/verify-email');
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.'),
});

export async function login(prevState: any, formData: FormData) {
  const result = loginSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
    };
  }

  const { email, password } = result.data;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (!userCredential.user.emailVerified) {
      return {
        errors: {
          _form: ['Please verify your email before logging in. A new verification link has been sent.'],
        },
      };
    }
  } catch (e: any) {
    if (e.code === 'auth/invalid-credential') {
      return { errors: { _form: ['Invalid email or password.'] } };
    }
    return { errors: { _form: ['An unexpected error occurred. Please try again.'] } };
  }
}

export async function logout() {
  await signOut(auth);
  redirect('/login');
}
