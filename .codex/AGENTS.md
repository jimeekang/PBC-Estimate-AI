# Codex project guidance

This project uses the global gstack install via `.codex/skills/gstack` and the global Superpowers install via `.codex/skills/superpowers`.

## Model Routing (역할)

이 저장소의 구현 담당은 **Codex 세션(GPT-5.5, reasoning: high)** 이다.

| 작업 유형 | 담당 모델 |
|---|---|
| 코딩·git·데이터베이스 등 모든 구현 작업 | **Codex GPT-5.5 (reasoning: high) — 이 세션이 담당** |
| 계획·기획·디자인·문서·아이디어 등 코딩 외 작업 | Claude Opus 4.8 (extra) |

- Codex 세션은 실제 코드 편집, 커밋, 마이그레이션, 배포 스크립트 등 구현 작업을 수행한다.
- 계획·설계·문서 개정안은 Claude Opus 4.8이 산출한다. Codex는 그 산출물을 코드/파일에 반영한다.

## gstack

- Use the matching gstack skill when the request maps to a workflow like QA, review, ship, investigate, browser automation, or deploy verification.
- For browser work, use `/browse` from gstack. Do not use `mcp__claude-in-chrome__*`.
- Treat these as explicit gstack commands: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## superpowers

- Use the matching Superpowers skill when the request maps to brainstorming, planning, TDD, subagent-driven-development, or agent workflow setup.
- Treat explicit Superpowers commands and aliases as skill invocations when they appear in the conversation or project docs.
- Prefer the Superpowers workflow over an ad-hoc answer when the user asks for a structured coding process.
