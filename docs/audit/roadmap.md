# 통합 로드맵 + KPI

모델 정책: 기획·문서·디자인 작업 = Claude Opus 4.8 (extra) / 코딩·git·DB 구현 = Codex GPT-5.5 (high).

## 즉시 (이번 주) — 버그·보안·정합성

- [ ] F20: firebase.json에 firestore rules 등록 + 콘솔 배포 상태 대조
- [ ] F1: interior 포함 합산 total에 35,000 cap 고정 분기
- [ ] B1: 쿼터 count status 필터(또는 권위 단일화) + draft 정리 잡
- [ ] B3: explanationPrompt try/catch → fallback 강등
- [ ] F28: admin rate limit 정책-코드 일치화 (정책 확정 필요)
- [ ] F11: email 필드 읽기전용 + client-side 사전 검증
- [x] F19/F25/F32: footer 연도·storage 주석·스킬 문서 정정 (문서 정리에서 처리)
- [ ] F31: 테스트 타이틀/cap 3자 동기화

## 30일 — 퍼널 개방 · 계측 · speed-to-lead

- [ ] F10: LiteEstimateForm 공개 라우트 + 랜딩 CTA 전체 재배선 (테스트 단언 수정 포함)
- [ ] GA4 계측 + 모든 Jobber CTA에 book_online_click + UTM 캡처
- [ ] Firestore onCreate → 사장 리드 알림 (이메일/SMS)
- [ ] F12/F13: 결과 자동 스크롤 + verify-email 재발송/자동 감지
- [ ] 결과 화면 재설계: 5.0★ 배지·리뷰, trust strip, tel:·콜백 폼 병렬
- [ ] F30: lite-full 캘리브레이션 정렬 (또는 고지)
- [ ] F14/F17/F18: 공개 Header·접근성·오류 안내

## 90일 — 확장 · 정밀도 · 차별화

- [ ] Suburb SEO 랜딩 세트 + JSON-LD + sitemap/robots
- [ ] Warm lead SMS 리마케팅 + GBP 리뷰 요청 자동화
- [ ] 어드민 → 리드 CRM (고가치 큐 + status + 채널별 CPL/CPA)
- [ ] F3/F2/F6 가격 정밀도 + 실발행가 대조 캘리브레이션 루프
- [ ] A/B 인프라(PostHog flags) + 모바일 LCP/INP
- [ ] B4/F23 AI 텍스트 가드레일 + F24 타입 게이트 복원
- [ ] 측정 기반 유료 채널 (Google Search/LSA + Meta 리타게팅 → lite 랜딩)

## KPI

- **북극성**: 견적 완료 → inspection 예약(book_online_click) 전환율 (현재 측정 불가, 0에서 시작)
- 퍼널: 랜딩→견적 시작률, 시작→완료율(스텝별)
- 리드: lite 견적 수, 이메일/전화 캡처 수, lite→full 전환율
- Speed-to-lead: 제출→최초 컨택(목표 5분), 리드→예약→수주 단계별, 노쇼율
- 경제성: 채널별 CPL·CPA, 평균 수주 job 가치, 견적 밴드 대비 계약가 오차
- 신뢰·로컬: GBP 리뷰 velocity, suburb 키워드 랭킹, 견적 클레임 건수
