
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_APP_ID,
};

// Log config presence (but not secrets) for debugging
console.log("Firebase Config Status:", {
  apiKey: !!firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId
});

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
auth.useDeviceLanguage(); 
const db = getFirestore(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
    if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
        console.error("Firebase configuration is missing in .env");
        throw new Error("Firebase configuration is missing.");
    }

    try {
        console.log("Attempting Google Sign-In with Popup...");
        const result = await signInWithPopup(auth, googleProvider);
        return result;
    } catch (error: any) {
        console.error("Google Sign-In Error Details:", error.code, error.message);
        throw error;
    }
}

export const getEstimates = async () => {
    const estimatesCol = collection(db, 'estimates');
    const estimateSnapshot = await getDocs(estimatesCol);
    const estimateList = estimateSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return estimateList;
}

export const getEstimate = async (id: string) => {
    const docRef = doc(db, 'estimates', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
    }
    return null;
}

export { auth, db };
