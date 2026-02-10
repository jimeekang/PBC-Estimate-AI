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
    // 구성 정보 확인을 위한 디버그 로그 (운영 환경에서는 삭제 권장)
    if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
        console.error("Firebase 구성 정보가 누락되었습니다! .env 파일을 확인해 주세요.");
        throw new Error("Firebase configuration is missing.");
    }

    try {
        console.log("Attempting signInWithPopup with domain:", firebaseConfig.authDomain);
        const result = await signInWithPopup(auth, googleProvider);
        return result;
    } catch (error: any) {
        console.error("Firebase Google Sign-In Detailed Error:", error.code, error.message);
        
        // 특정 에러 코드에 대한 추가 정보 제공
        if (error.code === 'auth/popup-closed-by-user') {
            console.warn("팝업이 닫혔습니다. 이는 브라우저 설정(쿠키 차단)이나 Authorized Domains 미등록 문제일 수 있습니다.");
        }
        
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
