---
description: Implement the feature according to the specification
argument-hint: <task or feature id from docs/SCOPE.md>
---

# /develop

Implement the feature according to the specification.

Task: $ARGUMENTS (required. If empty, ask which task from docs/SCOPE.md to build.)

## Read first
- CLAUDE.md
- The task and its acceptance criteria in docs/SCOPE.md
- The related parts of docs/ARCHITECTURE.md (tables, routes, rules)
- docs/AUDIT.md (check it says ready to code)

## Do
1. Restate the task and acceptance criteria in 3-5 lines. If anything is unclear, ask before writing code.
2. Plan the change: list the files you will create or edit.
3. Build in small steps. After each step the project must still build and run.
4. Follow the spec exactly:
   - table, column and route names come from docs/ARCHITECTURE.md
   - business rules (confirmed, estimate, stale) use the exact formulas in the docs
5. Security on every piece of code you write:
   - planner routes check that the wedding belongs to the logged-in planner
   - public routes accept only the invite token
   - validate all input on the server
   - never log tokens or phone numbers
6. Add a short comment only where the reason is not obvious. Do not comment obvious code.
7. Run the build and type check. Fix errors before finishing.

## Rules
- One task at a time. Do not build the next task "while you are there".
- No features, libraries or abstractions that are not in the spec. If you think the spec is wrong, stop and say so.
- Do not touch unrelated files.
- Do not write tests here. That is /test. Do not rewrite docs. That is /sync.
- Never put secrets in code. Use environment variables and update .env.example.
- If the task takes more than 2 hours of work, stop at a clean point and report what is left.

## Finish with
- Files changed (list)
- What works now, in plain words
- What you did NOT do or are unsure about
- Suggested next command (usually /test)
