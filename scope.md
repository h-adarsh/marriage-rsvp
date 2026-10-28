---
description: Turn the idea into a clear, ordered implementation plan
argument-hint: [optional: feature or milestone to scope]
---

# /scope

Convert the idea into a clear, ordered implementation plan.

Focus: $ARGUMENTS (if empty, scope the whole MVP)

## Read first
- PROJECT_CONTEXT.md (the only source of truth for scope, limits and milestones)
- docs/SCOPE.md if it already exists (update it, do not restart it)

## Do
1. List every MVP feature from PROJECT_CONTEXT.md as a user story: "As a <planner/guest>, I can <action> so that <result>".
2. Give each story clear acceptance criteria: 2-5 checks that can be true or false. No vague words like "fast" or "easy".
3. Break each story into tasks. Each task must fit in one 1-2 hour session and say what "done" looks like.
4. Put tasks in build order. Show what blocks what. Group them into the milestones M1-M4.
5. Add a "Not building" list. Copy it from PROJECT_CONTEXT.md and add anything new you spot.
6. Add a "Risks" list: the 5 things most likely to delay the project, and one way to reduce each.

## Output
Write docs/SCOPE.md with these sections:
- Goal (3 lines)
- Stories and acceptance criteria
- Ordered task list with time estimate per task (in hours)
- Not building
- Risks

## Rules
- Do not write code. Do not pick libraries or design tables. That is /architect.
- If a task is over 2 hours, split it.
- If the total looks bigger than the time in PROJECT_CONTEXT.md, say so plainly and cut scope. Do not hide it.
- If PROJECT_CONTEXT.md is unclear or contradicts itself, list the problem at the top of docs/SCOPE.md and ask the user before going on.
- Never add features the user did not ask for.

## Finish with
- Total estimated hours vs available hours
- The first 3 tasks to start with
