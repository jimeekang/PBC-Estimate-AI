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
import {
  AppCheck,
  getToken as getAppCheckToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
} from 'firebase/app-check';
import {
  initializeFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  Firestore,
  orderBy,
  query,
} from 'firebase/firestore';

function env(name: string) {
  return process.env[name]?.trim();
}

// Firebase Web API keys are public client identifiers by design.
// Security is enforced via Firestore Security Rules and App Check.
// See: https://firebase.google.com/docs/projects/api-keys
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
  messagingSenderId: env('NEXT_PUBLIC_MESSAGING_SENDER_ID') || defaultFirebaseConfig.messagingSenderId,
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
let appCheckInstance: AppCheck | null = null;

function isLocalDevelopmentHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

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
      if (isLocalDevelopmentHost()) {
        (
          self as typeof self & {
            FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
          }
        ).FIREBASE_APPCHECK_DEBUG_TOKEN =
          appCheckDebugToken ? (appCheckDebugToken === 'true' ? true : appCheckDebugToken) : true;
      }

      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      appCheckInitialized = true;
    });
  }

  await appCheckInitPromise;

  if (appCheckInstance) {
    try {
      await getAppCheckToken(appCheckInstance, false);
    } catch (error) {
      if (isLocalDevelopmentHost()) {
        throw new Error(
          'Local App Check debug token is not registered. Add the generated debug token to Firebase Console > App Check > Manage debug tokens, then restart the dev server.'
        );
      }

      throw error;
    }
  }
};

export const refreshAppCheckToken = async () => {
  await ensureAppCheck();

  if (appCheckInstance) {
    await getAppCheckToken(appCheckInstance, true);
  }
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

    if (error?.code === 'auth/firebase-app-check-token-is-invalid') {
      await refreshAppCheckToken();
      return signInWithPopup(auth, googleProvider);
    }

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
  const estimateSnapshot = await getDocs(query(estimatesCol, orderBy('createdAt', 'desc')));
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

export const uploadEstimatePhotos = async (idToken: string, photos: File[]): Promise<string[]> => {
  const formData = new FormData();

  photos.forEach((photo) => {
    formData.append('photos', photo);
  });

  const response = await fetch('/api/estimate-photos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | { photoPaths?: string[]; error?: string }
    | null;

  if (!response.ok || !payload?.photoPaths) {
    throw new Error(payload?.error || 'Photo upload failed.');
  }

  return payload.photoPaths;
};

export const getEstimatePhotoBlobUrl = async (idToken: string, photoPath: string): Promise<string> => {
  const response = await fetch(`/api/estimate-photos?path=${encodeURIComponent(photoPath)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Photo download failed.');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export { auth, db, isFirebaseConfigured };
