# PBC-Estimate-AI

AI를 활용한 전문 도장 견적 산출 서비스 "PBC Estimate AI"입니다.

## 주요 기능
- **AI 견적 생성**: Genkit과 Gemini 2.5 Flash를 활용한 정확한 가격 산출
- **사용자 맞춤형 폼**: 건물 유형, 작업 범위, 방 종류, 페인트 상태 등 상세 옵션 제공
- **이력 관리**: 생성된 견적 데이터를 Firebase Firestore에 저장
- **인증 시스템**: Firebase Auth를 통한 안전한 사용자 관리 (Google 로그인 및 이메일 인증)

## 최근 업데이트 사항
- **인증 에러 해결 가이드**: 구글 로그인 시 팝업이 자동으로 닫히는 현상(`auth/popup-closed-by-user`)을 해결하기 위해 에러 메시지에 도메인 승인 안내를 추가했습니다.
- **어드민 권한 관리**: `set-admin-claim.js` 스크립트를 통해 특정 계정에 어드민 권한을 부여하거나 해제할 수 있습니다.
- **견적 횟수 제한**: 일반 사용자는 2회로 제한되며, 어드민은 무제한으로 사용 가능합니다.
- **UI/UX 개선**: 폼 입력 시 직관적인 아이콘과 애니메이션을 추가하고, 빌드 에러(Module not found)를 수정했습니다.

## 기술 스택
- **Framework**: Next.js 15 (App Router)
- **AI**: Genkit, Google Generative AI
- **Backend/Auth**: Firebase (Firestore, Authentication)
- **UI/UX**: Tailwind CSS, Shadcn UI, Framer Motion

## 시작하기

### 1. 환경 설정
`.env` 파일에 필요한 API 키들을 설정하세요.

### 2. 어드민 권한 설정
특정 계정을 어드민으로 지정하려면 `set-admin-claim.js` 파일의 `userEmail`을 수정하고 아래 명령어를 실행하세요.
```bash
node set-admin-claim.js
```

### 3. 개발 서버 실행
```bash
npm install
npm run dev
```

## 트러블슈팅 (구글 로그인)
로그인 팝업이 즉시 닫힌다면:
1. 브라우저 설정에서 **서드파티 쿠키**가 허용되어 있는지 확인하세요.
2. Firebase Console > Authentication > Settings > **Authorized domains**에 현재 접속 주소를 등록하세요.
