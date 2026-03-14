# AGENTS.md

## Core workflow

- Always start with `agents/pbc-project-planner.md` to clarify scope, define the smallest valid implementation path, and sequence the work efficiently.
- Use `agents/frontend-senior-dev.md` for UI structure, component design, styling consistency, UX quality, and front-end implementation decisions.
- Use `agents/firebase-backend-dev.md` for Firestore schema changes, Auth flows, Hosting configuration, security rules, API integration, and backend logic.
- Use `agents/estimate-rule-designer.md` for quote logic, pricing anchors, estimate calculation rules, scope mapping, and painting-specific business logic.
- Use `agents/git-firebase-deployer.md` for branch hygiene, commit safety, deployment steps, Firebase environment setup, and release verification.

## Execution policy

- Prefer minimal diffs.
- Run tests before finalizing.
- Do not rewrite working modules unnecessarily.

## Token efficiency policy

- Be token-efficient in planning, reading, and responding.
- Inspect only the files, functions, and components relevant to the task.
- Prefer surgical edits over full-file rewrites.
- Avoid repeating context already established in the repository or prior steps.
- Do not output long code blocks unless the user requests them or the change requires them.
- Reuse existing utilities, components, types, and patterns before introducing new ones.
- Keep explanations short, concrete, and implementation-oriented.
- For multi-step work, propose a compact plan and execute incrementally.
- Avoid redundant searches, repeated file reads, and unnecessary re-analysis.
- Stop once the requested outcome is completed; do not expand scope without a clear reason.
