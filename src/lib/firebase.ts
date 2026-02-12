
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// 로컬 스토리지에 인증 상태 유지 설정
setPersistence(auth, browserLocalPersistence);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
    try {
        // 팝업 방식 시도
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
