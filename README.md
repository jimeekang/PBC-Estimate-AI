# PBC-Estimate-AI

AI를 활용한 전문 도장 견적 산출 서비스 "PBC Estimate AI"입니다.

## 주요 기능
- **AI 견적 생성**: Genkit과 Gemini 2.5 Flash를 활용한 정확한 가격 산출
- **사용자 맞춤형 폼**: 건물 유형, 작업 범위, 방 종류, 페인트 상태 등 상세 옵션 제공
- **이력 관리**: 생성된 견적 데이터를 Firebase Firestore에 저장
- **인증 시스템**: Firebase Auth를 통한 안전한 사용자 관리

## 기술 스택
- **Framework**: Next.js 15 (App Router)
- **AI**: Genkit, Google Generative AI
- **Backend/Auth**: Firebase (Firestore, Authentication)
- **UI/UX**: Tailwind CSS, Shadcn UI, Framer Motion

## 시작하기
제공된 `.env` 파일에 Firebase 및 Gemini API 키를 설정한 후 다음 명령어를 실행하세요.

```bash
npm install
npm run dev
```
