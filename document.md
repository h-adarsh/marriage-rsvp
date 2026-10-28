---
description: Write human-readable documentation, README, usage instructions or changelog
argument-hint: [optional: readme | usage | changelog | all]
---

# /document

Write human-readable documentation, README, usage instructions, or changelog.

Target: $ARGUMENTS (if empty, do all three)

## Read first
- PROJECT_CONTEXT.md, docs/SCOPE.md, docs/ARCHITECTURE.md
- docs/CHECK_REPORT.md and git log
- The running app (use it, do not guess)

## Who reads this
- A recruiter or engineer who has 2 minutes. They must understand what this is, that it works, and that it was built carefully.
- A developer who wants to run it. They must succeed in under 10 minutes by following the steps.

## Do

### README.md
1. One-line description, then 3-4 lines on the problem it solves.
2. Live demo link and a short demo video or GIF (leave a clear placeholder if missing).
3. Screenshots: planner dashboard, guest RSVP page on mobile, export.
4. Features list: only what actually works.
5. Tech stack, with one line on why for each choice.
6. Architecture: a simple diagram and a short description.
7. Security section: what is protected and how (authorization checks, token design, rate limits, input validation, CSV injection handling). Be specific and true.
8. Run it locally: exact commands, environment variables, how to seed demo data, how to run tests. Test these commands yourself.
9. Known limits and what is planned next (Phase 2). Be honest.

### docs/USAGE.md
- Step-by-step for a planner: create wedding, add functions, import guests (include the CSV format with an example), share links, read the dashboard, export for the caterer, use check-in.
- Step-by-step for a guest: what they see and do.
- Explain the numbers: what confirmed, maybe, no response and planning estimate mean, and how the estimate is calculated.

### CHANGELOG.md
- Keep a Changelog style: Added, Changed, Fixed, Security, grouped by version or milestone with dates.
- Build entries from git history and docs/SCOPE.md.

## Rules
- Never claim a feature, number or test result you have not verified. No made-up statistics, no "saves X% of food waste".
- Do not oversell. A clear, honest README is stronger than a hyped one.
- Plain, simple English. Short sentences. No filler or marketing words.
- Do not change code. If the docs reveal a problem in the code, list it for /debug.
- Run /sync first if the docs and code may be out of step.

## Finish with
- Files written
- Placeholders the user must fill (screenshots, live URL, video)
- Anything you could not verify
