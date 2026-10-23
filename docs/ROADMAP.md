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
| 핵심 회귀 테스트 10 스위트 / 222건 통과 (일회성 checklist 테스트 4개는 정리) | `npx jest` (2026-10-24) |
| F32 — 스킬 문서 인증 서술을 "Email/Password + Google"로 정정 | 2026-10-24 |

> 주의: 이전 로드맵에서 완료 표시됐던 **F19·F25는 코드에 반영되지 않았다** (footer `2023` 하드코딩, storage.rules 주석 "public read" 그대로). 아래 "즉시"로 되돌림.

## 2. 즉시 — 버그·보안·정합성

| ID | 등급 | 문제 | 위치 | 조치 | 단계 |
|---|---|---|---|---|---|
| F20 | High | `firestore.rules`가 `firebase.json`에 미등록 → 배포 시 rules 누락. admin 대시보드는 클라이언트 SDK 직접 읽기라 rules가 유일한 방어선 | `firebase.json` | `"firestore": {"rules": "firestore.rules"}` 추가 → 콘솔 배포본 대조 → `firebase deploy --only firestore:rules` 절차화 | implementer → app-security |
| F1 | High | Interior+Exterior 합산 total이 35,000 초과 가능 (`Math.max(MAX_PRICE_CAP, exteriorProjectCap)` → 최대 55,000) | `generate-painting-estimate.ts:1939` | interior 포함 합산은 35,000 고정, exterior 단독만 55,000 | estimate-rule-designer(승인) → implementer |
| B1 | High | 사진 경로 고아 draft가 무료 쿼터 1회 영구 소진. count가 status 무필터 | `src/app/estimate/actions.ts:201` `getUserEstimateCount` | `status=='generated'` 필터(또는 쿼터 권위 단일화) + 서버측 draft 정리/롤백 | implementer |
| B3 | Medium | `explanationPrompt` throw 시 견적 전체 실패 (try/catch 0건) | `generate-painting-estimate.ts:2041` | try/catch → 결정론적 fallback 설명 + timeout/retry | implementer |
| F28 | High | admin rate limit 완전 우회 — 정책 문서는 "admin도 rate limit" | `actions.ts` (`isAdmin` 분기 ~L352·L386) | **정책 결정 필요**: 코드에 적용 vs 문서를 실동작으로 수정 | 팀장 결정 → implementer |
| F11 | High | email 필드 편집 가능하지만 서버가 계정과 다르면 거부 → 4단계 완주 후 실패 | `estimate-form.tsx:3189` | 읽기전용 + "send a copy to" 선택 필드 분리, 최소 client 사전 검증 | frontend-senior-dev |
| F31 | Medium | 테스트 타이틀 "$7500" vs assert 6,700, cap 테스트가 문서와 다른 값 고정 | `pricing-engine.test.ts:153` | 타이틀 정정 + cap 값 코드·테스트·문서 3자 동기화 (F2와 함께) | implementer |
| F19 | Low | footer 연도 2023 하드코딩 | `src/components/footer.tsx:10` | `new Date().getFullYear()` + 연락처/ABN | quick_edit |
| F25 | Low | storage.rules 주석 "public read" ↔ 실제 owner-only | `storage.rules` | 주석을 "owner-only read; admin은 서버 API 경유"로 | quick_edit |

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

1. **F28** admin rate limit: 적용할지, 정책 문서를 "admin 무제한"으로 바꿀지
2. **F2/F31** range width cap 정책값 (코드 현재값: interior ≤5k→1,200 그 외 1,500 / exterior ≤3k→1,000, ≤8k→1,800, ≤10k→1,750, 그 외 2,000)
3. **F30** lite 캘리브레이션 정렬 vs 고지
4. **F1** 수정은 가격 변경이므로 영향 범위 설명 후 승인 (pbc-pricing 규칙)

## 6. 기각된 주장 — 다시 이슈로 올리지 말 것

F21 admin 페이지 클라이언트 isAdmin 의존(rules가 방어) · F22 getDashboardData email_verified 누락(읽기 전용) · F33 storey+difficulty 이중 적용(분리 로직 존재) · F7 극단 sqm 외삽(Zod 30~1200 제한) · F8 Deck/Paving 전용 배수 우회(스키마 거부) · F9 하드 하한 과대(allowZeroFloor 처리) · F5 HOUSE_INTERIOR_ANCHORS 과대(NB 프리미엄 범위 내) · F4 deck/paving cap 이후 가산(재현 실패) · F15 fixed CTA 가림(pb-28 확보) · F16 Google 리뷰 하드코딩(정상 관행) · B2 쿼터 소스 불일치(B1 중복) · B5 draft 승격 TOCTOU(경로 구성 실패) · B6 서버 액션 클라이언트 SDK(세션 미공유 설계)

## 7. KPI

- **북극성**: 견적 완료 → inspection 예약(`book_online_click`) 전환율 — 현재 측정 불가, 계측부터
- 퍼널: 랜딩→견적 시작률, 스텝별 시작→완료율
- 리드: lite 견적 수, 이메일/전화 캡처 수, lite→full 전환율
- Speed-to-lead: 제출→최초 컨택(목표 5분), 리드→예약→수주, 노쇼율
- 경제성: 채널별 CPL·CPA, 평균 수주 job 가치, 견적 밴드 대비 계약가 오차
- 신뢰·로컬: GBP 리뷰 velocity, suburb 키워드 랭킹, 견적 클레임 건수
