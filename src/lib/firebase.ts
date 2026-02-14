'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence, Auth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_APP_ID,
};

// Initialize Firebase only if API key is present to avoid hard crashes during SSR/Build
const app: FirebaseApp = (!getApps().length && firebaseConfig.apiKey) 
  ? initializeApp(firebaseConfig) 
  : (getApps().length ? getApp() : {} as FirebaseApp);

const auth: Auth = firebaseConfig.apiKey ? getAuth(app) : {} as Auth;
const db: Firestore = firebaseConfig.apiKey ? getFirestore(app) : {} as Firestore;

// Set persistence to local storage only on the client-side
if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
  setPersistence(auth, browserLocalPersistence);
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
    if (typeof window === 'undefined') {
        throw new Error("This function can only be called on the client side.");
    }
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result;
    } catch (error: any) {
        console.error("Google Sign-In Error Details:", error.code, error.message);
        throw error;
    }
}

export const getEstimates = async () => {
    if (!firebaseConfig.apiKey) return [];
    const estimatesCol = collection(db, 'estimates');
    const estimateSnapshot = await getDocs(estimatesCol);
    const estimateList = estimateSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return estimateList;
}

export const getEstimate = async (id: string) => {
    if (!firebaseConfig.apiKey) return null;
    const docRef = doc(db, 'estimates', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
    }
    return null;
}

export { auth, db };
