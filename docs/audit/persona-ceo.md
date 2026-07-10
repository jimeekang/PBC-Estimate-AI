# 페르소나 전략 — CEO (페인팅 비즈니스 오너)

관심사: 리드 수·질, 견적→inspection 전환율, 평균 job 가치, 노쇼율, 마진 방어, AI 운영비 대비 수익.

## 진단

- 자산: 결정론적 가격(마진 방어 안전), 고품질 리드 데이터(verified email + 호주 전화번호 required), 전환 소재(QR·PDF·5.0★/104).
- 구멍: ① 익명 방문자가 가격을 못 봄 ② 리드 알림(speed-to-lead) 전무 — 리드가 Firestore에 조용히 쌓임 ③ Jobber 예약 클릭 미추적 ④ 어드민이 passive 테이블($30k와 $2k 리드 무구분) ⑤ "Powered by AI"가 오히려 불신 자초 — 진짜 무기는 "로컬 캘리브레이션 즉시 견적".

## 전략

| 우선순위 | 전략 | 핵심 |
|---|---|---|
| P0 | 익명 즉시 견적 노출 (로그인 게이트 제거) | LiteEstimateForm(AI 비용 0)을 공개 라우트로. 랜딩→견적 시작 2~4배 기대 |
| P0 | Speed-to-lead 알림 | submitEstimate 성공 시 Resend/Twilio로 사장에게 즉시 push. "15분 내 연락" SLA 운영화 |
| P0 | Jobber booking 클릭 추적 | 모든 BOOKING_URL CTA에 이벤트(estimateId·가격밴드·suburb·UTM). 목표 25%+ |
| P1 | 어드민 → 리드 CRM | 고가치($15k+/exterior/multi-storey) 큐 + status(신규/컨택/예약/수주/실주) |
| P1 | 결과 화면 재설계 + 포지셔닝 전환 | "firm written quote" trust strip. 카피를 "Sydney NB 2026 실거래가 캘리브레이션 — not a guess"로 |
| P2 | 캘리브레이션 루프 (마진 방어) | AI 견적가 vs 실제 발행가를 어드민에서 대조 → 분기별 앵커 보정 |

## KPI

랜딩→견적 시작률 / 견적→Jobber 클릭률(25%+) / 리드 최초 응답 시간 / 노쇼율 / 평균 수주 job 가치 / AI 견적가 대비 실제 발행가 편차.
