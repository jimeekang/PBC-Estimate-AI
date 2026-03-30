# CLAUDE.md

Project: PBC Estimate AI
Purpose: Agent-driven development with minimal token usage.

---

# Core Rules

1. Always minimize token usage.
2. Never read unnecessary files.
3. Never load the entire repository unless explicitly requested.
4. Prefer summaries over full code outputs.
5. Only output changed code sections unless asked for full files.

---

# File Reading Strategy

Claude must follow this order:

1. Read only relevant files.
2. Prefer reading:
   - config files (`next.config.ts`, `tailwind.config.ts`, `tsconfig.json`)
   - schema files (`src/schemas/`)
   - type definitions
   - pricing constants (`src/lib/pricing-engine.ts`, `src/lib/estimate-constants.ts`)
3. Avoid reading large UI files unless necessary.

Never automatically read:

- node_modules
- build folders
- .next
- dist
- coverage
- lock files

---

# Code Editing Rules

When modifying code:

1. Show only modified sections
2. Avoid rewriting full files
3. Keep code style consistent
4. Preserve existing architecture

If unsure:

→ ask for the specific file before proceeding.

---

# Planning Workflow

Claude acts as **Planner Agent**.

Process:

1. Understand task
2. Break task into subtasks
3. Assign subtasks to specialized agents

Available agents (Claude Code built-in):

- `pbc-project-planner` — scope, sequencing, roadmap
- `frontend-senior-dev` — UI, components, styling, UX
- `firebase-backend-dev` — Firestore, Auth, API routes, server logic
- `estimate-rule-designer` — pricing anchors, estimate rules, modifier logic
- `git-firebase-deployer` — commits, deployment, release
- `project-tester` — unit/integration tests, QA
- `app-security` — security audit, Firebase rules, credentials

Planner outputs **step-by-step execution plan only**.

Do NOT write full implementation unless requested.

---

# Context Loading

Load context only when required.

Important project folders:

```
src/
├── ai/              — Genkit AI flows (estimate generation)
├── app/             — Next.js App Router pages & server actions
│   ├── (auth)/      — login, signup, forgot-password, verify-email
│   ├── (protected)/ — estimate, dashboard, admin
│   ├── (public)/    — landing page
│   ├── api/         — API routes (photo upload)
│   └── estimate/    — server actions (estimate submission)
├── components/      — React components (UI, forms, admin)
├── hooks/           — custom hooks (use-mobile, use-toast)
├── lib/             — utilities, Firebase client, pricing engine
├── providers/       — auth-provider (Firebase Auth context)
├── schemas/         — Zod validation schemas
└── __tests__/       — Jest unit tests
```

Avoid loading:

/public
/node_modules

---

# Response Style

Use structured outputs:

Task Summary
Plan
Files Needed
Next Action

Avoid long explanations.

---

# Estimate AI Rules

The project contains pricing logic.

Important:

- Never change pricing anchors without confirmation.
- Maintain Sydney Northern Beaches market calibration (2026).
- Avoid double counting modifiers (especially storey + difficulty overlap).
- Preserve price floors and ceilings (`MAX_PRICE_CAP = 35000`).
- `pricing-engine.ts` must remain pure functions only (no 'use server', no genkit).

If editing pricing logic:

→ explain impact before modification.

---

# Estimate Usage Policy

- Non-admin users: **2 free estimates**.
- Admin users: unlimited estimates.
- Promotional +1 estimate via coupon/event may be explored later, but it is not confirmed product policy and should not be treated as implemented.
- Rate limits: 30s interval, 5/hour, 10/day (abuse prevention, separate from free quota).

---

# Security Rules

Never expose:

- API keys
- Firebase secrets
- environment variables

Never print `.env` values.

App Check (reCAPTCHA v3) is enabled for production.
Admin access is managed via Firebase custom claims (`admin: true`).

---

# Default Behaviour

If instruction unclear:

Ask before acting.

If task large:

Break into subtasks first.

---

# Goal

Build a scalable AI-assisted painting estimate platform for Sydney Northern Beaches with controlled token usage.
