# Codex project guidance

This project uses the global gstack install via `.codex/skills/gstack` and the global Superpowers install via `.codex/skills/superpowers`.

## gstack

- Use the matching gstack skill when the request maps to a workflow like QA, review, ship, investigate, browser automation, or deploy verification.
- For browser work, use `/browse` from gstack. Do not use `mcp__claude-in-chrome__*`.
- Treat these as explicit gstack commands: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

## superpowers

- Use the matching Superpowers skill when the request maps to brainstorming, planning, TDD, subagent-driven-development, or agent workflow setup.
- Treat explicit Superpowers commands and aliases as skill invocations when they appear in the conversation or project docs.
- Prefer the Superpowers workflow over an ad-hoc answer when the user asks for a structured coding process.
