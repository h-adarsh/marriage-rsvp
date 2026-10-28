---
description: Create or update project context files, requirements and code understanding before coding
argument-hint: [optional: area or folder to audit]
---

# /audit

Create or update the project context files, requirements, and existing code understanding before coding.

Focus: $ARGUMENTS (if empty, audit the whole project)

## Read first
- PROJECT_CONTEXT.md, docs/SCOPE.md, docs/ARCHITECTURE.md
- The code in the repo (if any exists yet)
- Existing CLAUDE.md and docs/AUDIT.md (update, do not overwrite useful content)

## Do
1. Check the docs against each other. Look for:
   - features in SCOPE with no design in ARCHITECTURE
   - routes or tables in ARCHITECTURE that no story needs
   - rules in PROJECT_CONTEXT that SCOPE or ARCHITECTURE ignore
2. If code exists, map it: folders, entry points, main modules, how data flows, what is finished, what is half-done, what is dead code.
3. Compare code with the docs. List every difference and say which one is right.
4. Find gaps before coding: missing decisions, unclear requirements, missing environment variables or setup steps.
5. Create or update CLAUDE.md in the repo root. Keep it short (under 80 lines). It must contain:
   - what the project is, in 3 lines
   - how to install, run, test and build (exact commands)
   - folder map
   - coding rules (TypeScript strict, validate input on the server, check authorization on every planner route, never log tokens)
   - what is out of scope
   - pointers to the docs
6. List open questions that block coding. Ask the user the 3 most important ones.

## Output
- docs/AUDIT.md: findings, differences, gaps, open questions, and a clear "ready to code: yes / no" with reasons
- CLAUDE.md (created or updated)

## Rules
- Do not change application code in this step.
- Do not fix the docs silently. Report each conflict first. Only edit docs when the answer is clear, and say what you changed.
- Be specific: file names, line areas, table names. No vague findings.
- If the answer is "not ready", stop and say exactly what is missing.
