# `.codex/skills` in this repo

This folder contains project-local skill entry points for Codex.

`pbc-*` directories here are not copied skill files. They are Windows junctions that point to the real source files in [`.claude/skills`](</c:/Users/kjm12/OneDrive/바탕 화면/Project/PBC-Estimate-AI/.claude/skills>).

Why this exists:
- Codex can discover project skills from `.codex/skills`
- We keep one source of truth in `.claude/skills`
- Junctions let both paths resolve to the same files

Practical rule:
- Edit PBC skills in `.claude/skills`
- Treat `.codex/skills/pbc-*` as link-only views
- If Git shows `pbc-*` under `.codex/skills`, the ignore rules likely need to be refreshed
