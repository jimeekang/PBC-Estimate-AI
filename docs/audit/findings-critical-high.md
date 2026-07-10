# 확정 Finding — Critical · High

검증: 3-렌즈(correctness / business-impact / reproduction) 다수결 통과.

## [F10] Critical — "무료 AI 견적" CTA 전부가 가입+이메일 인증 벽 뒤

- 랜딩의 모든 무료 견적 CTA가 `/estimate`(인증 게이트)로 연결 → 미로그인 시 `/login` replace.
- 가입은 이메일 인증까지 강제. "2 Free AI Estimates ... No signup fee" 문구와 정면 모순.
- 익명 즉시 견적용 `LiteEstimateForm`은 완성됐으나 어떤 page.tsx에도 미연결 (`public-home-cta-copy.test.ts`가 부재를 고정).
- **권고**: LiteEstimateForm을 공개 라우트(`/lite-estimate` 등)로 노출 + 랜딩 CTA 재배선 (테스트 단언 수정 포함).

## [F20] High — firestore.rules가 firebase.json에 미등록 (배포 누락)

- `firebase.json`에 storage/apphosting만 있고 `firestore` 키 없음 → `firebase deploy`가 규칙을 배포하지 않음.
- admin 대시보드는 클라이언트 SDK 직접 읽기라 rules가 유일한 방어선. 미배포 시 타인 견적(PII) 조회·스크래핑 가능.
- **권고**: `"firestore": { "rules": "firestore.rules" }` 추가 + 콘솔 배포 규칙 대조 + `deploy --only firestore:rules` 절차화.

## [F1] High — Interior+Exterior 합산 total이 MAX_PRICE_CAP(35,000) 초과 가능

- `generate-painting-estimate.ts:1939`: 3층 풀 외부 시 `totalProjectCap = Math.max(35000, 55000)` → 합산 total이 55,000까지 통과.
- **권고**: interior 포함(isBoth/isInt) 합산에는 35,000 고정, exterior 단독일 때만 55,000 허용 분기.

## [F28] High — Admin에 rate limit 미적용 (정책 문서와 반대)

- 문서: "어드민도 rate limit 적용, 무료 쿼터만 무제한". 코드(`actions.ts:545`): `if (!estimateId && !isAdmin)` — admin은 완전 우회.
- **권고**: admin에도 rate limit 적용(무료 cap만 면제) 또는 정책 문서를 실동작으로 확정.

## [B1] High — 고아 draft가 무료 쿼터 1회를 영구 소진

- 사진 경로: draft 생성 시 쿼터 +1 예약 → `submitEstimate(estimateId)` 승격. 이 경로는 `reservedUid` 미설정이라 실패 시 서버 롤백 없음 (클라이언트 cleanup에만 의존).
- `getUserEstimateCount`/`getDashboardData`는 status 무필터 count → 고아 draft가 견적 1건으로 계산.
- **권고**: count에 `status=='generated'` 필터(또는 쿼터 권위 단일화) + 서버측 draft TTL/정리 잡 + 실패 시 서버 롤백.

## [F11] High — 이메일 필드 수정 시 위저드 4단계 완주 후에야 서버 거부

- email 필드가 편집 가능하지만 서버는 로그인 계정과 다르면 거부. 클라이언트 사전 검증 없음 → 폼 완주 후 destructive 토스트.
- **권고**: email 읽기전용 + "send a copy to" optional 필드 분리, 최소한 client-side 즉시 검증.

## [F12] High — 견적 결과가 폼 하단 렌더인데 자동 스크롤 없음

- `estimate-form.tsx:3554` 결과가 form 뒤에 위치, `scrollIntoView` 0건 → 모바일에서 가격·예약 CTA를 놓침.
- **권고**: 제출 성공 시 결과 컨테이너로 `scrollIntoView({behavior:'smooth'})` 1회.

## [F13] High — 이메일 인증 페이지가 막다른 길

- `/verify-email`: 재발송 버튼 없음, 인증 완료 감지 없음, 유일한 액션이 signOut→/login. 메일 미수신 시 루프에 갇힘.
- **권고**: "Resend"(쿨다운) + "I've verified — continue"(reload 후 /estimate) + 주기적 reload 폴링.
