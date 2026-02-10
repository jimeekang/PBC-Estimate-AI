
const admin = require('firebase-admin');

// ===============================================================================================
// === 어드민 권한 설정 가이드 =====================================================================
// ===============================================================================================

// 1. 서비스 계정 키 파일 경로 (이미 설정됨)
const serviceAccount = require('./studio-5245261553-378c8-firebase-adminsdk-fbsvc-032b22c6a5.json');

// 2. 어드민 권한을 수정할 사용자의 이메일 주소를 입력하세요.
const userEmail = 'kjm12081@gmail.com';

// 3. 권한 설정 여부 (true: 부여, false: 해제)
const isAdmin = false;

// ===============================================================================================

// Firebase Admin SDK 초기화
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
    if (error.code !== 'app/duplicate-app') {
        console.error('Firebase Admin SDK 초기화 중 오류 발생:', error);
        process.exit(1);
    }
}

// 이메일로 사용자 찾기 및 권한 수정
async function updateAdminClaim() {
  try {
    const user = await admin.auth().getUserByEmail(userEmail);
    const uid = user.uid;

    // 'admin' 커스텀 클레임을 설정/해제
    await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });

    if (isAdmin) {
      console.log(`성공: ${userEmail} (UID: ${uid}) 계정에 어드민 권한이 부여되었습니다.`);
    } else {
      console.log(`성공: ${userEmail} (UID: ${uid}) 계정의 어드민 권한이 해제되었습니다.`);
    }
    
    console.log('해당 사용자는 앱에서 로그아웃 후 다시 로그인해야 권한이 적용됩니다.');
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`오류: '${userEmail}' 사용자를 찾을 수 없습니다. 먼저 앱에서 회원가입을 완료해 주세요.`);
    } else {
      console.error('권한 설정 중 오류 발생:', error);
    }
    process.exit(1);
  }
}

updateAdminClaim();
