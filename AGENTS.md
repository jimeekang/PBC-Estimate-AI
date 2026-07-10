# AGENTS.md — PBC Estimate AI

Stack: Next.js + Firebase + GenKit AI. Market: Sydney Northern Beaches (2026).

---

## Core Rules

- 불필요한 파일 읽지 않기. `node_modules`, `.next`, `dist`, lock files 자동 읽기 금지.
- 코드 수정 시 변경된 부분만 출력 (전체 파일 재작성 금지).
- 불명확하거나 큰 태스크 → 먼저 물어보고 서브태스크로 분해.
- 토큰 효율 우선 — 이미 알고 있는 컨텍스트는 반복하지 않음.

---

## Model Routing (모델 라우팅 정책)

작업 성격에 따라 담당 모델을 분리한다:

| 작업 유형 | 담당 모델 | Reasoning |
|---|---|---|
| 계획·기획·디자인·문서 작업·아이디어 등 코딩 외 작업 | Claude Opus 4.8 | extra (최고 추론) |
| 코딩·git·데이터베이스 등 모든 구현 작업 | Codex GPT-5.5 | high |

- 실제 코드/파일 구현·커밋·마이그레이션은 Codex 세션(`.codex/AGENTS.md` 참조)이 수행한다.
- Claude는 분석·설계·문서 개정안까지 산출하고, 최종 코드 반영은 Codex/오케스트레이터가 담당한다.

---

## Domain Rules (파일 참조)

작업 도메인에 따라 아래 파일을 읽고 규칙을 적용할 것:

| 도메인 | 규칙 파일 |
|---|---|
| 가격/견적 로직 수정 | `.claude/skills/pbc-pricing/SKILL.md` |
| 기능 계획, 에이전트 라우팅 | `.claude/skills/pbc-plan/SKILL.md` |
| 배포, 커밋 | `.claude/skills/pbc-deploy/SKILL.md` |
| 보안 감사 | `.claude/skills/pbc-security/SKILL.md` |
| 테스트 작성/실행 | `.claude/skills/pbc-test/SKILL.md` |

---

## Agent Roster

| Agent | Domain | When to Use |
|---|---|---|
| `pbc-project-planner` | 범위, 로드맵, 스프린트 | 새 기능, 멀티스텝 태스크, 우선순위 정리 |
| `frontend-senior-dev` | UI, 컴포넌트, 스타일, UX | 페이지/컴포넌트 생성, 레이아웃, 폼 UX |
| `firebase-backend-dev` | Firestore, Auth, API, 서버 로직 | CRUD, 인증 플로우, Cloud Functions |
| `estimate-rule-designer` | 가격 앵커, 견적 규칙, modifier | 가격 캘리브레이션, 새 서비스 카테고리 |
| `git-firebase-deployer` | 커밋, 배포, 릴리즈 | 기능 완료 후 커밋 + 배포 |
| `project-tester` | 유닛/통합 테스트, QA | 테스트 작성, 커버리지, 로직 검증 |
| `app-security` | 보안 감사, Firebase rules | 배포 전 보안 점검, API 인증 검토 |

---

## Responsibility Boundaries

- `src/domains/estimate/domain/pricing/pricing-engine.ts` → `estimate-rule-designer` 소유. 순수 함수만. 앵커 변경 전 사용자 확인 필수.
- `src/domains/estimate/application/generation/` → 가격 로직은 `estimate-rule-designer`, 플로우 실행 방식은 `firebase-backend-dev`.
- `src/domains/estimate/presentation/components/` → `frontend-senior-dev`. 스키마 변경 시 `firebase-backend-dev` 리뷰 필요.
- `src/app/estimate/actions.ts` → `firebase-backend-dev`. 비율 제한, Firestore 쓰기, 인증 포함.
- `src/lib`, `src/schemas`, `src/ai/flows`, `src/components/estimate`의 estimate 관련 파일은 호환 wrapper만 둔다. 새 estimate 코드는 `src/domains/estimate`를 직접 import한다.

---

## Audit

- 최신 전체 감사 리포트 인덱스: [`docs/audit/README.md`](docs/audit/README.md) (2026-07-09).
