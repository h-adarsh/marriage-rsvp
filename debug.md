---
description: Fix the root cause of failures or unexpected behaviour found during checking
argument-hint: [bug id from docs/CHECK_REPORT.md, or describe the problem]
---

# /debug

Fix the root cause of any failures or unexpected behaviour found during checking.

Problem: $ARGUMENTS (if empty, start with the highest-severity open bug in docs/CHECK_REPORT.md)

## Read first
- docs/CHECK_REPORT.md (the bug, steps to reproduce, severity)
- CLAUDE.md
- The related spec in docs/ARCHITECTURE.md and the acceptance criteria in docs/SCOPE.md
- The code involved

## Do
1. Reproduce the bug first. Run the exact steps or failing test and see it fail. If you cannot reproduce it, stop and report that.
2. Find the root cause. Trace from the symptom back to the real source. Write the cause in 1-3 lines.
3. Decide which side is wrong: the code, the test, or the spec. Say which, with evidence.
4. Fix the cause, not the symptom. Do not add a special case that hides the problem.
5. Add or update a test that fails before the fix and passes after it. This stops the bug from returning.
6. Run the full test suite, not just the one test. Make sure nothing else broke.
7. Look for the same mistake elsewhere (for example, the same missing authorization check on a similar route). Fix or list those too.

## Rules
- One bug at a time.
- No guess-and-check edits. State your theory, test it, then change code.
- Keep the fix small. No refactors or new features in a bug fix.
- Never remove or weaken a security check or test to make something pass.
- Never skip or delete a failing test unless the test itself is proven wrong. Explain why.
- If the real fix needs a spec change, stop and ask the user first.

## Finish with
- Root cause (plain words)
- What you changed and why this fixes the cause
- The test that now protects it
- Full suite result
- Other places with the same problem
- Suggested next command (/check again, then /sync)
