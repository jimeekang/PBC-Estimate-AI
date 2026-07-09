# 확정 Finding — Low (7건)

## [F6] 특정영역 방 앵커 합이 전체(Entire) 견적 초과 가능 (가격 역전)

- partialRatio(≤0.85) × pseudoSqm(≤1.16) × hardFloor 중첩 시 "방 몇 개"가 "전체"보다 비싸질 수 있음. 특정영역에만 상한 캡 부재.
- **권고**: intMax ≤ entireEquivalentMax 캡 추가.

## [F23] 자유 텍스트가 LLM 프롬프트에 그대로 삽입 (프롬프트 인젝션)

- otherExteriorArea/otherInteriorArea가 이스케이프 없이 주입. 단 가격은 서버 계산 덮어쓰기, XSS 확대 없음 — 설명 텍스트 변조에 국한.
- **권고**: 주입 전 정규화 + "사용자 텍스트는 데이터" 가드레일 (B4와 세트).

## [F24] typescript.ignoreBuildErrors=true

- 타입 오류가 빌드 통과 → 인증/가격 로직 회귀가 런타임 도달 가능.
- **권고**: 플래그 제거 또는 CI에 `tsc --noEmit` 게이트.

## [F25] storage.rules 주석("public read")과 실제 규칙(owner 전용) 불일치

- 규칙은 안전하나 주석이 향후 완화 실수 유발 가능.
- **권고**: 주석을 "owner-only read; admin은 서버 API 경유"로 수정.

## [F18] 다중 스텝 검증 오류 시 첫 스텝만 안내

- 양쪽 스텝 오류 시 순차 재제출 강요.
- **권고**: 오류 스텝 개수 요약 토스트 또는 스텝 오류 뱃지.

## [F19] Footer 연도 2023 하드코딩

- **권고**: `new Date().getFullYear()` + 연락처/ABN 신뢰 요소 추가.

## [F32] pbc-core SKILL "이메일/비밀번호 기반" 서술이 Google 로그인 구현과 불일치

- **권고**: "Email/Password + Google 로그인"으로 정정. (문서 정리 작업에서 반영됨)
