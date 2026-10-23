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

Codex는 Claude Code 팀장(분석·계획·설계 Claude Fable 5.1 / high, 작업 분배·진행 확인 Claude Opus 5.5 / medium)에게 작업을 받아 실행하고 진행 상황·결과를 반환하는 **실행 세션**이다. 전체 단계표는 [CLAUDE.md](CLAUDE.md#orchestration-모델-라우팅)를 따른다.

모델·effort의 기준은 [전역 AGENTS.md](<C:/Users/kjm12/.codex/AGENTS.md>)의 "모델, reasoning effort와 업무별 위임" 절이다. 사용자가 앱·실행 옵션에서 명시적으로 선택한 설정을 우선하며, 별도 선택이 없는 기본값은 **GPT-6.1 Sol / high**이다.

| 역할 | 작업 유형 | 모델 | Reasoning effort |
|---|---|---|---|
| analyst | 요구사항·설계·리뷰·QA·테스트 전략과 결과 분석·UI/UX·복잡한 구조 판단 | GPT-6 Astra | xhigh |
| implementer | 확정 설계의 구현 계획·코딩·git·DB·일반 수정·테스트 작성과 실행 | GPT-6.1 Sol | high |
| quick_edit | 정답과 범위가 명확한 저위험 코드·CSS·문구·숫자 수정 | GPT-6 Luna | high |
| explorer | 코드·파일·문서의 읽기 전용 탐색 | GPT-6 Astra | high |

- 비판적 리뷰·분석 결과는 analyst(GPT-6 Astra / xhigh)가 작성해 팀장에게 반환한다. UI/UX 직접 구현은 Claude Opus 5.5 / high(`frontend-senior-dev`), 코드 검토·최종 통합 확인은 Claude Opus 5.5 / high가 담당한다.
- 프로젝트의 도메인 에이전트 이름은 전문 분야를 나타낸다. 위임할 때는 실제 작업 단계에 맞는 전역 역할을 선택한다. 가격·권한·데이터에 영향을 주는 변경은 quick_edit로 분류하지 않는다.
- 전역 역할의 실제 실행 설정은 `C:/Users/kjm12/.codex/agents/{역할}.toml`을 따른다. 그 외 에이전트는 현재 채팅의 모델·effort를 상속한다. 역할 목록만으로 위임을 요구하지 않는다.
- `.claude/agents/*.md`의 `model`/`effort`는 Claude 실행기 설정(Fable 5.1 / Opus 5.5)이다. Markdown 수정만으로 실행 중인 채팅의 모델이나 Claude 실행기를 GPT로 전환하지 않는다. 지정 모델을 지원하지 않으면 제한을 알리고 임의 대체하지 않는다.

---

## Domain Rules (파일 참조)

작업 도메인에 따라 아래 파일을 읽고 규칙을 적용할 것:

| 도메인 | 규칙 파일 |
|---|---|
| 가격/견적 로직 수정 | `.claude/skills/pbc-pricing/SKILL.md` |
| 기능 계획, 우선순위 | `.claude/agents/pbc-project-planner.md`, `docs/ROADMAP.md` |
| 배포, 커밋 | `.claude/agents/git-firebase-deployer.md` |
| 보안 감사 | `.claude/agents/app-security.md` |
| 테스트 작성/실행 | `.claude/agents/project-tester.md` |

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

## Roadmap

- 진행 현황·남은 작업(2026-07-09 감사 결과 통합): [`docs/ROADMAP.md`](docs/ROADMAP.md).
