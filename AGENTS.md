# AGENTS.md

## Core Workflow

1. **Start with `pbc-project-planner`** — clarify scope, define smallest valid path, sequence the work.
2. Delegate to specialized agents based on task domain.

## Agent Roster

| Agent | Domain | When to Use |
|-------|--------|-------------|
| `pbc-project-planner` | Scope, sequencing, roadmap | New features, multi-step tasks, sprint planning |
| `frontend-senior-dev` | UI, components, styling, UX | Page/component creation, layout fixes, form UX, design system |
| `firebase-backend-dev` | Firestore, Auth, API routes, server logic | CRUD operations, auth flows, security rules, Cloud Functions |
| `estimate-rule-designer` | Pricing anchors, estimate rules, modifiers | Price calibration, new service categories, modifier logic |
| `git-firebase-deployer` | Commits, deployment, release | Feature complete → commit + push + deploy |
| `project-tester` | Unit/integration tests, QA | Test writing, coverage improvement, logic verification |
| `app-security` | Security audit, Firebase rules, credentials | Pre-deploy security check, API auth review, OWASP audit |

## Responsibility Boundaries

### Pricing logic (`src/lib/pricing-engine.ts`)
- **Owner**: `estimate-rule-designer`
- **Rule**: Pure functions only. No 'use server', no genkit, no Next.js dependencies.
- **Review**: Any anchor change requires user confirmation before applying.

### AI flows (`src/ai/flows/`)
- **Owner**: `estimate-rule-designer` (business logic) + `firebase-backend-dev` (Genkit integration)
- **Boundary**: If the change is about *what price to output* → `estimate-rule-designer`. If the change is about *how the flow runs* → `firebase-backend-dev`.

### Estimate form (`src/components/estimate/`)
- **Owner**: `frontend-senior-dev`
- **Coordination**: Schema changes (`src/schemas/`) need `firebase-backend-dev` review.

### Server actions (`src/app/estimate/actions.ts`)
- **Owner**: `firebase-backend-dev`
- **Includes**: Rate limiting, Firestore writes, auth verification.

## Execution Policy

- Prefer minimal diffs.
- Run tests before finalizing.
- Do not rewrite working modules unnecessarily.

## Token Efficiency Policy

- Inspect only relevant files, functions, and components.
- Prefer surgical edits over full-file rewrites.
- Avoid repeating context already established.
- Reuse existing utilities, components, types, and patterns.
- Keep explanations short, concrete, and implementation-oriented.
- Stop once the requested outcome is completed; do not expand scope.
