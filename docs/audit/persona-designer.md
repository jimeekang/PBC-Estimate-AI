# 페르소나 전략 — CRO 프로덕트 디자이너

## 진단 (화면별)

- **랜딩**: 신뢰 신호 밀도는 좋으나 "Book Online"(외부 Jobber)이 filled primary — AI 견적 앱이 방문자를 앱 밖으로 먼저 밀어냄. 서비스 카드 6개 전부 cursor-default dead end. sticky 바가 모바일 상시 점유.
- **가입**: 첫 마이크로 전환(가격 확인)에 최대 마찰(가입+인증) 배치 — 역순 설계. verify-email 막다른 길.
- **위저드**: 스텝 UX는 견고. 단 Step 3에서 견적도 못 본 사용자에게 "Book Online Now" 반복 노출.
- **결과**: booking CTA 카드 자체는 잘 설계(그라디언트·QR·마이크로카피). 문제는 스크롤로만 도달 + "AUD 8,000-18,000 (+GST)" 큰 숫자 직후 신뢰 재확인 요소 전무.
- **모바일**: 앱 전체에 전화번호/tel: 링크 0개 — 로컬 서비스 최고 전환 채널 부재.

## 전략

| 우선순위 | 전략 | 핵심 |
|---|---|---|
| P0 | 무료 견적을 로그인 벽 앞으로 | public lite 라우트 (홈 임베드 아닌 별도 라우트로 기존 테스트 충돌 회피) |
| P0 | 결과 자동 스크롤 | scrollIntoView 1회 — 최저 비용·최대 효과. 예약 CTA 노출률 ~100%로 |
| P0 | 랜딩 CTA 위계 스왑 | "Start Free AI Estimate"를 primary로, Book은 secondary. "See your price first, then book" |
| P1 | verify-email 복구 | Resend(쿨다운) + continue 버튼 + 인증 감지 자동 redirect |
| P1 | 전화번호 + one-tap call | header·결과·모바일 sticky에 tel: 링크. NAP 일관성은 로컬 SEO에도 기여 |
| P1 | 가격 충격 완화 프레이밍 | "Most NB 3-bed projects land near the lower-to-mid range" 앵커 + 압축 신뢰 블록 + min 굵게/max 보조 톤 |
| P2 | 서비스 카드 → 프리필 진입점 | Roof 카드 → roof 프리셋 견적. 카드에 가격 힌트 |
| P2 | 위저드 내 예약 CTA 절제 | Step 3 booking 박스 축소, 예약 유도는 결과 화면으로 집중 |

## KPI

랜딩→견적 시작률 / 시작→완료율(스텝별 drop-off) / 완료→예약 CTA 노출·클릭률 / 인증 완료율 / 가격 노출 직후 이탈률(sticker shock) / 모바일 vs 데스크톱 전환 격차.
