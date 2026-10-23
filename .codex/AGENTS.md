# Codex project guidance

This project uses the global gstack install via `.codex/skills/gstack` and the Superpowers Codex plugin.

Role: Codex is the **execution session** in the orchestration defined in [CLAUDE.md](../CLAUDE.md#orchestration-모델-라우팅). It receives tasks from the Claude Code lead, reports progress and results back, and writes critical reviews with analyst (GPT-6 Astra / xhigh).

## Model Routing (역할)

- [전역 AGENTS.md](<C:/Users/kjm12/.codex/AGENTS.md>)와 [프로젝트 모델 라우팅](../AGENTS.md#model-routing-모델-라우팅-정책)을 따른다. 사용자 명시 선택을 우선하며, 별도 선택이 없는 기본값은 **GPT-6.1 Sol / high**이다.
- 위임 시 analyst는 **GPT-6 Astra / xhigh**, implementer는 **GPT-6.1 Sol / high**, quick_edit는 **GPT-6 Luna / high**, explorer는 **GPT-6 Astra / high**를 사용한다.
- 분석·설계·리뷰·QA 판정은 analyst, 구현·git·DB·테스트 작성과 실행은 implementer 기준으로 분류한다. 네 역할의 실제 설정은 전역 `agents/*.toml`을 따르며, 그 외 에이전트는 현재 채팅 설정을 상속한다.
- 문서의 역할 지정은 현재 주 채팅의 모델을 자동 전환하지 않는다. 지정 모델이 지원되지 않으면 제한을 알리고 임의 대체하지 않는다.

## gstack

- Use the matching gstack skill when the request maps to a workflow like QA, review, ship, investigate, browser automation, or deploy verification.
- For browser work, use `/browse` from gstack. Do not use `mcp__claude-in-chrome__*`.
- Treat these as explicit gstack commands: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## superpowers

- Use the matching Superpowers skill when the request maps to brainstorming, planning, TDD, subagent-driven-development, or agent workflow setup.
- Treat explicit Superpowers commands and aliases as skill invocations when they appear in the conversation or project docs.
- Prefer the Superpowers workflow over an ad-hoc answer when the user asks for a structured coding process.
