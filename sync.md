---
description: Bring files back into alignment after fixes (generated, context and spec files)
argument-hint: [optional: area to sync]
---

# /sync

Bring files back into alignment after fixes. Update generated, context and spec files if needed.

Focus: $ARGUMENTS (if empty, sync everything)

## Read first
- Recent changes (git diff or git log since the last sync)
- docs/CHECK_REPORT.md
- PROJECT_CONTEXT.md, docs/SCOPE.md, docs/ARCHITECTURE.md, docs/AUDIT.md, CLAUDE.md

## Do
1. List what changed in code since the last sync: tables, routes, rules, env variables, commands, folders.
2. For each change, find the doc that describes it and check it still matches. Look especially at:
   - database tables and constraints vs docs/ARCHITECTURE.md
   - API routes, bodies and auth rules vs docs/ARCHITECTURE.md
   - business formulas vs PROJECT_CONTEXT.md section 6
   - run, test and build commands vs CLAUDE.md
   - .env.example vs the variables the code reads
3. Check generated files are current: migrations, API types, lockfile.
4. Update SCOPE.md: mark finished tasks, move unfinished ones, record anything dropped and why.
5. Update docs/AUDIT.md "ready to code" status and open questions.
6. If code and spec disagree, decide which is right:
   - If the code is right (a good decision made during build), update the doc and add a line to the decision log.
   - If the spec is right, the code is wrong. Do NOT change the doc to match. Report it and send it to /debug.

## Rules
- Do not change application behaviour in this step. Docs and generated files only.
- Every doc edit must be explained in the summary. No silent rewrites.
- Do not delete requirements to make things "match". Dropping a requirement is a user decision. Ask.
- Keep CLAUDE.md under 80 lines.

## Finish with
- Files updated (list, with one line each on what changed)
- Disagreements between code and spec that still need a decision
- Anything out of date that you could not fix
- Suggested next command (/develop for the next task, or /document at a milestone)
