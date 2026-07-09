# 확정 Finding — Medium (8건)

## [F3] 3B2B Fair 캘리브레이션이 누적 계산을 폐기하고 재계산

- `calibrate3B2BFairHouse`가 누적 값(앵커×areaFactor×조건×층수×trim)을 무시하고 sqm 곡선으로 대체.
- sqm 미입력 시 135 고정 → "벽만"과 "벽+천장+trim"이 같은 base 가능. delta는 층수-인플레 재가산.
- **권고**: fair 곡선을 base와 blend / areaFactor 반영 / delta는 층수 곱 이전 기준.

## [F30] 동일 3B2B 입력에 lite vs full 견적 25~50% 괴리

- lite $8,118~9,020 vs full $10,000~13,500 (재현 확인). lite에 3B2B 캘리브레이션·storey uplift 없음.
- **권고**: lite에 동일 캘리브레이션 반영 또는 "상세 견적은 달라질 수 있음" 명확 고지.

## [B3] AI 설명 생성 실패가 견적 전체 실패로 직결

- `explanationPrompt` throw(5xx/타임아웃/스키마 실패)에 try/catch 없음. output null fallback만 존재.
- **권고**: try/catch로 fallback 강등 + genkit timeout/retry 정책.

## [B4] AI 텍스트(explanation/details)가 재검증 없이 영속화

- 자유 텍스트 주입 프롬프트의 산출물이 최소 가공 후 저장 → 인젝션 유도 문구가 견적 문서에 잔존 가능.
- **권고**: 길이·패턴 검증 후 실패 시 결정론적 fallback 대체.

## [F2] capRangeWidthSmart 실제 값이 주석/문서와 불일치 + 비단조 구간

- 실제: interior ≤5k→1,200 그 외 1,500 / exterior ≤3k→1,000, ≤8k→1,800, ≤10k→1,750, 그 외 2,000.
- 문서(1,800/2,500/3,500 등)와 전혀 다르고 exterior $8k→$10k에서 cap 감소(역전).
- **권고**: 정책 확정 후 코드·주석·문서 동기화, 비단조 정리.

## [F31] 테스트가 낡은 기대값 고정

- B1 테스트 타이틀 "$7500" vs assert 6,700. E-그룹 cap 테스트가 문서와 충돌하는 코드값을 고정.
- **권고**: 타이틀 정정 + cap 정책 3자(코드·테스트·문서) 동기화.

## [F14] 랜딩·auth 화면에 네비게이션/로고 홈 링크 없음

- `(public)` 그룹에 layout 없음, auth 로고는 링크 아님.
- **권고**: 공개용 경량 Header + 로고 홈 링크 + Footer 공유.

## [F17] 위저드 스텝이 스크린리더에 진행 상태 미전달

- `aria-current` 없음, 라벨 sr-only뿐 (WCAG 소지).
- **권고**: `aria-current="step"` + 상태 aria-label + 시각적 진행 텍스트(2/4).
