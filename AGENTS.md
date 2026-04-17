# AGENTS.md — PBC Estimate AI

Stack: Next.js + Firebase + GenKit AI. Market: Sydney Northern Beaches (2026).

---

## Core Rules

- 불필요한 파일 읽지 않기. `node_modules`, `.next`, `dist`, lock files 자동 읽기 금지.
- 코드 수정 시 변경된 부분만 출력 (전체 파일 재작성 금지).
- 불명확하거나 큰 태스크 → 먼저 물어보고 서브태스크로 분해.
- 토큰 효율 우선 — 이미 알고 있는 컨텍스트는 반복하지 않음.

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

- `src/lib/pricing-engine.ts` → `estimate-rule-designer` 소유. 순수 함수만. 앵커 변경 전 사용자 확인 필수.
- `src/ai/flows/` → 가격 로직은 `estimate-rule-designer`, 플로우 실행 방식은 `firebase-backend-dev`.
- `src/components/estimate/` → `frontend-senior-dev`. 스키마 변경 시 `firebase-backend-dev` 리뷰 필요.
- `src/app/estimate/actions.ts` → `firebase-backend-dev`. 비율 제한, Firestore 쓰기, 인증 포함.
