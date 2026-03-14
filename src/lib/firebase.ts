'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence,
  Auth,
} from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  initializeFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  Firestore,
} from 'firebase/firestore';

function env(name: string) {
  return process.env[name]?.trim();
}

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyD2qyDSXm1rmSSUqzFpD3ix198jc4Bh_iQ',
  authDomain: 'studio-5245261553-378c8.firebaseapp.com',
  projectId: 'studio-5245261553-378c8',
  storageBucket: 'studio-5245261553-378c8.firebasestorage.app',
  messagingSenderId: '176887759680',
  appId: '1:176887759680:web:2debce89454733ddb970a5',
};

const firebaseConfig = {
  apiKey: env('NEXT_PUBLIC_API_KEY') || defaultFirebaseConfig.apiKey,
  authDomain: env('NEXT_PUBLIC_AUTH_DOMAIN') || defaultFirebaseConfig.authDomain,
  projectId: env('NEXT_PUBLIC_PROJECT_ID') || defaultFirebaseConfig.projectId,
  storageBucket: env('NEXT_PUBLIC_STORAGE_BUCKET') || defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    env('NEXT_PUBLIC_MESSAGING_SENDER_ID') || defaultFirebaseConfig.messagingSenderId,
  appId: env('NEXT_PUBLIC_APP_ID') || defaultFirebaseConfig.appId,
};
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

// Initialize Firebase only if API key is present to avoid hard crashes during SSR/Build
const app: FirebaseApp =
  !getApps().length && isFirebaseConfigured
    ? initializeApp(firebaseConfig)
    : getApps().length
      ? getApp()
      : ({} as FirebaseApp);

const auth: Auth = isFirebaseConfigured ? getAuth(app) : ({} as Auth);
const isAppCheckEnabled = env('NEXT_PUBLIC_ENABLE_APPCHECK') === 'true';
const appCheckSiteKey = env('NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY');
const appCheckDebugToken = env('NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN');
let appCheckInitialized = false;
let appCheckInitPromise: Promise<void> | null = null;

// ✅ IMPORTANT: ignoreUndefinedProperties prevents Firestore from rejecting undefined fields
const db: Firestore = firebaseConfig.apiKey
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : ({} as Firestore);

// (optional safety) In case initializeFirestore is called elsewhere and you want a getter:
// const db: Firestore = firebaseConfig.apiKey ? getFirestore(app) : ({} as Firestore);

// Set persistence to local storage only on the client-side
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  setPersistence(auth, browserLocalPersistence);
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const ensureAppCheck = async () => {
  if (
    typeof window === 'undefined' ||
    !isFirebaseConfigured ||
    !isAppCheckEnabled ||
    !appCheckSiteKey ||
    appCheckInitialized
  ) {
    return;
  }

  if (!appCheckInitPromise) {
    appCheckInitPromise = Promise.resolve().then(() => {
      if (window.location.hostname === 'localhost' && appCheckDebugToken) {
        (
          self as typeof self & {
            FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
          }
        ).FIREBASE_APPCHECK_DEBUG_TOKEN =
          appCheckDebugToken === 'true' ? true : appCheckDebugToken;
      }

      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      appCheckInitialized = true;
    });
  }

  await appCheckInitPromise;
};

export const signInWithGoogle = async () => {
  if (typeof window === 'undefined') {
    throw new Error('This function can only be called on the client side.');
  }
  if (!isFirebaseConfigured) {
    throw new Error('Firebase configuration is missing.');
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    console.error('Google Sign-In Error Details:', error.code, error.message);

    if (
      error?.code === 'auth/internal-error' ||
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
};

export const getEstimates = async () => {
  if (!isFirebaseConfigured) return [];
  await ensureAppCheck();
  const estimatesCol = collection(db, 'estimates');
  const estimateSnapshot = await getDocs(estimatesCol);
  const estimateList = estimateSnapshot.docs.map(d => ({
    ...d.data(),
    id: d.id,
  }));
  return estimateList;
};

export const getEstimate = async (id: string) => {
  if (!isFirebaseConfigured) return null;
  await ensureAppCheck();
  const docRef = doc(db, 'estimates', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { ...docSnap.data(), id: docSnap.id };
  }
  return null;
};

export { auth, db, isFirebaseConfigured };
