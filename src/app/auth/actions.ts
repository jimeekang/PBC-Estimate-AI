'use server';

import { auth } from '@/lib/firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
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
      return { errors: { email: ['이미 사용 중인 이메일입니다.'] } };
    }
    return { errors: { _form: ['회원가입 중 예상치 못한 오류가 발생했습니다. 다시 시도해 주세요.'] } };
  }

  return { success: true };
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
      await sendEmailVerification(userCredential.user);
      return {
        errors: {
          _form: ['이메일 인증이 필요합니다. 인증 메일이 발송되었습니다. 확인 후 다시 로그인해 주세요.'],
        },
      };
    }
  } catch (e: any) {
    if (e.code === 'auth/invalid-credential') {
      return { errors: { _form: ['이메일 또는 비밀번호가 올바르지 않습니다.'] } };
    }
    return { errors: { _form: ['로그인 중 예상치 못한 오류가 발생했습니다. 다시 시도해 주세요.'] } };
  }

  return { success: true };
}
