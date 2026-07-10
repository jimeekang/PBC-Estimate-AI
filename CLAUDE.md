# PBC Estimate AI

Stack: Next.js + Firebase + GenKit AI. Market: Sydney Northern Beaches (2026).

## Rules

- 불필요한 파일 읽지 않기. `node_modules`, `.next`, `dist`, lock files 자동 읽기 금지.
- 코드 수정 시 변경된 부분만 출력 (전체 파일 재작성 금지).
- 불명확하거나 큰 태스크 → 먼저 물어보고 서브태스크로 분해.

## Model Routing (모델 라우팅)

| 작업 | 모델 |
|---|---|
| 계획·기획·디자인·문서·아이디어 (코딩 외) | Claude Opus 4.8 (extra / 최고 추론) |
| 코딩·git·DB 등 모든 구현 | Codex GPT-5.5 (reasoning: high) |

## Skills (필요 시 호출)

| 작업 | 스킬 |
|---|---|
| 가격/견적 로직 수정 | `/pbc-pricing` |
| 기능 계획, 에이전트 라우팅 | `/pbc-plan` |
| 배포, 커밋 | `/pbc-deploy` |
| 보안 감사 | `/pbc-security` |
| 테스트 작성/실행 | `/pbc-test` |
