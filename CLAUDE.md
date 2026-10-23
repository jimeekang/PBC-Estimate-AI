# PBC Estimate AI

Stack: Next.js + Firebase + GenKit AI. Market: Sydney Northern Beaches (2026).

## Rules

- 불필요한 파일 읽지 않기. `node_modules`, `.next`, `dist`, lock files 자동 읽기 금지.
- 코드 수정 시 변경된 부분만 출력 (전체 파일 재작성 금지).
- 불명확하거나 큰 태스크 → 먼저 물어보고 서브태스크로 분해.

## Orchestration (모델 라우팅)

| 단계 | 담당 | 모델 / effort |
|---|---|---|
| 1. 전체 분석·계획·설계 | Claude Code 팀장 (`pbc-project-planner`, `estimate-rule-designer`) | Claude Fable 5.1 / high |
| 2. 작업 분배·진행 확인·추가 지시 | Claude Code 팀장 ↔ Codex 실행 세션 | Claude Opus 5.5 / medium |
| 3a. UI/UX 직접 구현 | `frontend-senior-dev` | Claude Opus 5.5 / high |
| 3b. 구현 실행 | Codex — analyst · implementer · quick_edit · explorer | GPT-6 Astra / xhigh · GPT-6.1 Sol / high · GPT-6 Luna / high · GPT-6 Astra / high |
| 4. 비판적 리뷰·분석 결과 | Codex analyst | GPT-6 Astra / xhigh |
| 5. 코드 검토·최종 통합 확인 | Claude Code (`app-security`, `project-tester`, `git-firebase-deployer`) | Claude Opus 5.5 / high |

- 사용자 명시 선택을 우선한다. 지정 모델을 쓸 수 없으면 알리고 임의 대체하지 않는다.
- Claude 도메인 에이전트는 `.claude/agents/*.md` frontmatter(`model`/`effort`)로 위 단계에 고정한다. Codex 역할의 실제 설정은 `~/.codex/agents/*.toml`, 위임 기준은 [AGENTS.md](AGENTS.md#model-routing-모델-라우팅-정책).
- 메인 세션(팀장)의 모델·effort는 md로 바뀌지 않는다. 1단계는 Fable 5.1 / high, 2단계는 Opus 5.5 / medium으로 `/model`에서 전환한다.
- 가격·권한·데이터 변경은 quick_edit로 분류하지 않는다.

## Skills (필요 시 호출)

| 작업 | 스킬 |
|---|---|
| 가격/견적 로직 수정 | `/pbc-pricing` |
| 기능 계획, 우선순위 | `pbc-project-planner` 에이전트 + [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| 배포, 커밋 | `git-firebase-deployer` 에이전트 |
| 보안 감사 | `app-security` 에이전트 |
| 테스트 작성/실행 | `project-tester` 에이전트 |
