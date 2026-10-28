---
description: Design the system, components, APIs, database and technical specs
argument-hint: [optional: area to design, e.g. "rsvp api"]
---

# /architect

Design the system. Define components, APIs, database, and technical specifications.

Focus: $ARGUMENTS (if empty, design the whole MVP)

## Read first
- PROJECT_CONTEXT.md (stack, data model rules, security requirements)
- docs/SCOPE.md
- docs/ARCHITECTURE.md if it exists (update it, keep decisions that still hold)

## Do
1. Component view: frontend, API, database. Show how they talk. Include a simple text or Mermaid diagram.
2. Database: full table list with columns, types, keys, unique constraints, indexes and foreign keys. Use the fixes in PROJECT_CONTEXT.md section 8:
   - planners table
   - household_functions table
   - one RSVP row per (function, household)
   - audit_log table
3. API: list every route with method, path, who can call it (planner / public token), request body, response, and error cases.
4. Auth design: how planner sessions work, how the invite token is created, checked and scoped.
5. Business rules as exact formulas: confirmed, declined, maybe, no response, planning estimate, stale flag. Use PROJECT_CONTEXT.md section 6.
6. Validation rules for every input field.
7. Folder structure for frontend and backend.
8. Threat model: for each of these, how it is attacked and how the design stops it:
   - guessing an invite token
   - one planner reading another planner's wedding
   - guest submitting bad data (negative party size, huge text)
   - CSV import abuse (huge file, formula injection)
   - login brute force
9. Decision log: for each real choice (for example, token storage), write the options, the choice, and the tradeoff in 2-3 lines.

## Output
Write docs/ARCHITECTURE.md. Also write the table definitions as a first migration file only if the user asks.

## Rules
- Design only what is in docs/SCOPE.md. Mark any Phase 2 idea as "later" and do not design it in detail.
- Keep it simple. No microservices, queues or extra services.
- Every route must say how authorization is checked. A route with no stated check is a bug in the design.
- Do not write application code.
- If the scope needs something the stack cannot do, say so and suggest the smallest change.
