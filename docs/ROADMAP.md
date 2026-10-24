# ROADMAP — 진행 현황과 남은 작업

> 기준일: 2026-10-24 · 출처: 2026-07-09 전체 감사(확정 23건) + 현재 코드 대조
> 실행 단계·모델: [CLAUDE.md](../CLAUDE.md#orchestration-모델-라우팅) Orchestration 표

## 1. 완료

| 항목 | 근거 |
|---|---|
| 결정론적 가격 엔진 (AI는 설명만 생성, 가격 hallucination 불가) | `src/domains/estimate/domain/pricing/pricing-engine.ts` |
| estimate 도메인 구조화 (domain / application / presentation, 구 경로는 wrapper) | `aafa40c` |
| Jobber 예약 퍼널·CTA 정렬, 견적 UI 가이드 플로우 | `cbb3439`, `e09b88c`, `014b8f8` |
| App Hosting 커스텀 도메인 연결 | `e90c7e3` |
| 익명 견적 폼 `LiteEstimateForm` + `lite-estimate/actions.ts` (코드만 완성, 라우트 미연결) | F10 참고 |
| 핵심 회귀 테스트 10 스위트 / 304건 통과 (2026-10-24 시작 시 222건) | `npx jest` |
| F32 — 스킬 문서 인증 서술을 "Email/Password + Google"로 정정 | 2026-10-24 |
| F20 — `firebase.json`에 rules 등록 + **운영 rules 배포**(클라이언트 쓰기 전면 차단, 직전 배포본은 클라이언트 `create` 허용). 배포 후 스캔: estimates 2건 모두 서버 생성 | PR #1, 2026-10-24 |
| B1 — 쿼터 = 사용자 전체 문서(legacy `status` 없음 포함) − 30분 무활동 draft. 신규 저장·draft 승격은 같은 트랜잭션에서 단일 `userId` snapshot으로 재검사, stale draft는 삭제하지 않고 집계 제외 | PR #1 |
| B3 — 설명 생성 20초 타임아웃 + 비타임아웃 오류 1회 재시도 → 결정론적 fallback | PR #1 |
| F28 — admin도 비율 제한 적용(무료 쿼터만 면제). 수정(`estimateId`) 경로에도 비율 제한, draft 첫 승격 예외는 AI 전 트랜잭션 claim(1회·실패 시 미복원), 승격 쿼터는 AI 전 사전 확인. `estimateId`·`photoPaths` 형식/소유 검증 | PR #1 (Wave 2) |
| F11 — 비admin email 읽기전용 + 제출 전 불일치 차단 ("send a copy to"는 발송 인프라 부재로 보류) | PR #1 |
| F1 — 현 동작 유지 결정(3층+전체 외벽이면 합산도 55k), 회귀 테스트 2건 + pbc-pricing SKILL.md 정정 | PR #1 (Wave 2) |
| F31 — 테스트 타이틀 정정, range width cap 현재값을 SKILL.md에 문서화 (exterior 8k→10k 역전은 F2로) | PR #1 |
| F19 footer 연도 자동 + 이메일 · F25 storage.rules 주석 정정 | PR #1 |

## 2. 즉시 — 남은 후속 (2026-10-24 리뷰에서 도출)

| 항목 | 내용 | 단계 |
|---|---|---|
| 실환경 검증 | 실제 로그인 계정으로 F11 email 잠금·제출 차단, admin 대시보드 목록/상세(rules 배포 후), 사진 견적 1건 draft→승격 | 사용자 / frontend-senior-dev |
| `next build` | 이번 변경 후 빌드 미실행 (`ignoreBuildErrors` 때문에 tsc와 별도 확인 필요, F24와 연계) | implementer |
| Firestore emulator 테스트 | rules 허용/거부 케이스 + B1/F28 트랜잭션 동시성을 stub이 아닌 emulator로 검증 | project-tester |
| 수정 재요청 UX | 결과 수신 후 30초 내 수정 재요청은 거부됨 → 남은 시간 안내 문구 | frontend-senior-dev |
| 고아 draft 사진 | 30분 무활동 draft는 집계만 제외되고 문서·Storage 사진은 남음 → 보존 정책 + 정리 잡 | firebase-backend-dev |
| admin 클레임 운영 | 클레임 부여 절차 문서화, 회수 시 `revokeRefreshTokens` | app-security |

## 3. 30일 — 퍼널 개방 · 계측 · speed-to-lead

| ID | 문제 | 조치 | 단계 |
|---|---|---|---|
| F10 (Critical) | "무료 AI 견적" CTA 전부가 가입+이메일 인증 벽(`/estimate`) 뒤. "No signup" 문구와 모순 | `LiteEstimateForm`을 공개 라우트(`/lite-estimate`)로 노출 + 랜딩 CTA 재배선. `public-home-cta-copy.test.ts`가 현재 "부재"를 고정하므로 함께 수정 | 팀장 설계 → frontend-senior-dev |
| 계측 | GA4/Pixel/PostHog 0건 → 견적→예약 전환율 측정 불가 | GA4 + 모든 Jobber CTA에 `book_online_click`(estimateId·가격밴드·suburb·UTM) | implementer |
| Speed-to-lead | 리드가 Firestore에 조용히 쌓임 (알림 인프라 없음) | 견적 생성 시 사장에게 이메일/SMS 알림, "15분 내 연락" SLA | firebase-backend-dev |
| F12 | 결과가 폼 하단 렌더, `scrollIntoView` 0건 → 모바일에서 가격·CTA 놓침 | 제출 성공 시 결과로 smooth scroll 1회 | frontend-senior-dev |
| F13 | `/verify-email` 막다른 길 (재발송·인증 감지 없음) | Resend(쿨다운) + "인증 완료 — 계속" + 주기적 reload | frontend-senior-dev |
| 결과 화면 | 신뢰 요소 부족 | 5.0★ 리뷰, "firm written quote" trust strip, tel:·콜백 폼 병렬 | frontend-senior-dev |
| F30 | 같은 3B2B 입력에 lite $8.1k~9.0k vs full $10.0k~13.5k (25~50% 괴리) | lite에 동일 캘리브레이션 반영 또는 "상세 견적과 다를 수 있음" 고지 — **결정 필요** | estimate-rule-designer |
| F14 | 랜딩·auth에 내비게이션/로고 홈 링크 없음 (`(public)` layout 없음) | 공개용 경량 Header + 공유 Footer | frontend-senior-dev |
| F17 | 위저드 스텝 진행 상태가 스크린리더에 미전달 (`aria-current` 0건) | `aria-current="step"` + "2/4" 진행 텍스트 | frontend-senior-dev |
| F18 | 여러 스텝 검증 오류 시 첫 스텝만 안내 | 오류 스텝 요약 토스트 또는 스텝 뱃지 | frontend-senior-dev |

## 4. 90일 — 확장 · 정밀도 · 차별화

- Suburb SEO 랜딩 세트(northern-beaches-painters, dee-why-painters, house-painting-costs-northern-beaches) + JSON-LD + sitemap/robots — 폴더만 있고 미착수였음
- Warm lead SMS 리마케팅 + GBP 리뷰 요청 자동화
- 어드민 → 리드 CRM: 고가치($15k+/exterior/multi-storey) 큐 + status(신규/컨택/예약/수주/실주) + 채널별 CPL/CPA
- 가격 정밀도: **F3** 3B2B Fair 캘리브레이션이 누적값을 버리고 sqm 곡선으로 재계산 · **F2** `capRangeWidthSmart` 값이 문서와 불일치 + exterior $8k→$10k 구간 역전 · **F6** 특정영역 합이 Entire 견적을 넘을 수 있음(intMax ≤ entire 캡 필요) · 실발행가 대조 캘리브레이션 루프
- A/B 인프라(PostHog flags) + 모바일 LCP/INP — 첫 실험 후보: 예약 CTA 문구 "Book Online Now" vs "Book Your Free Site Visit"
- **B4/F23** AI 설명 텍스트 재검증 없이 저장 + 자유 텍스트가 프롬프트에 그대로 삽입 → 길이·패턴 검증, "사용자 텍스트는 데이터" 가드레일
- **F24** `next.config.ts` `ignoreBuildErrors: true` 제거 또는 CI `tsc --noEmit` 게이트
- 측정 기반 유료 채널 (Google Search/LSA + Meta 리타게팅 → lite 랜딩)

## 5. 결정이 필요한 항목

1. **F30** lite 캘리브레이션 정렬 vs 고지
2. **F2** exterior range width cap 8k→10k 역전(1,800→1,750) 해소 여부 — 가격 변경이므로 estimate-rule-designer 검토 후 승인

> 2026-10-24 결정 완료: F28(admin도 비율 제한, 쿼터만 면제) · F1(현 동작 유지) · F31(현재 cap 값 문서화) · F19(연도+이메일만)

## 6. 기각된 주장 — 다시 이슈로 올리지 말 것

F21 admin 페이지 클라이언트 isAdmin 의존(rules가 방어) · F22 getDashboardData email_verified 누락(읽기 전용) · F33 storey+difficulty 이중 적용(분리 로직 존재) · F7 극단 sqm 외삽(Zod 30~1200 제한) · F8 Deck/Paving 전용 배수 우회(스키마 거부) · F9 하드 하한 과대(allowZeroFloor 처리) · F5 HOUSE_INTERIOR_ANCHORS 과대(NB 프리미엄 범위 내) · F4 deck/paving cap 이후 가산(재현 실패) · F15 fixed CTA 가림(pb-28 확보) · F16 Google 리뷰 하드코딩(정상 관행) · B2 쿼터 소스 불일치(B1 중복) · B5 draft 승격 TOCTOU(경로 구성 실패) · B6 서버 액션 클라이언트 SDK(세션 미공유 설계)

## 7. KPI

- **북극성**: 견적 완료 → inspection 예약(`book_online_click`) 전환율 — 현재 측정 불가, 계측부터
- 퍼널: 랜딩→견적 시작률, 스텝별 시작→완료율
- 리드: lite 견적 수, 이메일/전화 캡처 수, lite→full 전환율
- Speed-to-lead: 제출→최초 컨택(목표 5분), 리드→예약→수주, 노쇼율
- 경제성: 채널별 CPL·CPA, 평균 수주 job 가치, 견적 밴드 대비 계약가 오차
- 신뢰·로컬: GBP 리뷰 velocity, suburb 키워드 랭킹, 견적 클레임 건수
