# 기각된 주장 — 14건 (재보고 방지)

적대적 검증에서 코드 재확인 결과 실제 결함이 아니거나 다른 계층에서 방어됨이 확인된 주장.
**향후 감사/리뷰에서 이 항목들을 다시 이슈로 올리지 말 것.**

| ID | 주장 | 기각 사유 |
|---|---|---|
| F21 | admin 페이지가 클라이언트 isAdmin에만 의존 | firestore.rules(get=소유자\|admin, list=admin)가 실질 방어선. 클라이언트 체크는 UI 게이트일 뿐 |
| F22 | getDashboardData의 email_verified 누락 | 읽기 전용이라 실질 영향 없음. 쓰기 액션은 모두 검증함 |
| F33 | interior storey+difficulty 이중 적용 | 명시적 분리 로직 존재 (정책 준수) |
| F7 | 극단적 sqm 무한 외삽 | Zod가 approxSize min(30).max(1200) 제한 — 도달 불가 |
| F8 | Deck/Paving 전용 견적 조건 배수 우회 | 스키마가 빈 exteriorAreas 거부 — 도달 불가 |
| F9 | 하드 하한(800/1200) 소액 과대 계상 | allowZeroFloor 예외 분기가 실제 케이스 처리 |
| F5 | HOUSE_INTERIOR_ANCHORS 과대 | Northern Beaches 프리미엄 감안 시 범위 내 |
| F4 | deck/paving 가산이 cap 이후라 폭 과대 | 실제 문제 수준 재현 실패 |
| F15 | fixed CTA 콘텐츠 가림/접근성 | pb-28 여백으로 가림 방지 확인 |
| F16 | Google 리뷰 하드코딩 신뢰 리스크 | 정적 마케팅 콘텐츠로 정상 관행 (개선 아이디어로는 페르소나 전략에 반영) |
| B2 | remainingEstimates 쿼터 소스 불일치 | B1과 중복되는 표면 증상 |
| B5 | draft 승격 TOCTOU 경합 | 악용/오동작 경로 구성 실패 |
| B6 | 서버 액션에서 클라이언트 SDK 사용 | 세션 미공유 설계로 실질 문제 없음 |
| F26 | (1차 backend 에이전트 더미 출력) | 플레이스홀더 아티팩트 — 검증 시스템이 자동 기각, backend 렌즈 재실행으로 B1·B3·B4 확보 |
