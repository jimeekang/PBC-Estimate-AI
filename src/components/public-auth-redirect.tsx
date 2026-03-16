'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onIdTokenChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';

export function PublicAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, (user) => {
      if (user) {
        router.replace('/estimate');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return null;
}
