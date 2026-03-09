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
   - config files
   - schema files
   - type definitions
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

Example agents:

- frontend-agent
- backend-agent
- ai-agent
- firebase-agent
- testing-agent

Planner outputs **step-by-step execution plan only**.

Do NOT write full implementation unless requested.

---

# Context Loading

Load context only when required.

Important project folders:

/src
/components
/lib
/ai
/firebase
/config

Avoid loading:

/public
/assets
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
- Maintain Sydney market calibration.
- Avoid double counting modifiers.
- Preserve price floors and ceilings.

If editing pricing logic:

→ explain impact before modification.

---

# Security Rules

Never expose:

- API keys
- Firebase secrets
- environment variables

Never print `.env` values.

---

# Default Behaviour

If instruction unclear:

Ask before acting.

If task large:

Break into subtasks first.

---

# Goal

Build a scalable AI-assisted painting estimate platform with controlled token usage.
