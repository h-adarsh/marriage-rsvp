---
description: Run the code and tests, review results and verify correctness
argument-hint: [optional: feature or milestone to check]
---

# /check

Run the code and tests, review results, and verify correctness.

Focus: $ARGUMENTS (if empty, check everything built so far)

## Read first
- CLAUDE.md (commands to build, run, test)
- docs/SCOPE.md (acceptance criteria)
- docs/ARCHITECTURE.md (rules and security design)

## Do
1. Run, in order, and record the real output:
   - install, type check, lint, build
   - the full test suite
   - the app itself (start it and use it)
2. Verify each acceptance criterion for the focus area. Mark each: pass / fail / not tested. Base this on what you ran, not on what the code looks like.
3. Walk the main flow by hand or with the end-to-end test: create wedding, add guests, share link, guest RSVP, dashboard numbers, CSV export. Check that the numbers on screen match the formulas in the docs. Do the arithmetic yourself on a small example.
4. Security review:
   - every planner route has an authorization check
   - no public route exposes sequential IDs or other households' data
   - input validation exists on the server, not just in the browser
   - no secrets or tokens in code or logs
5. Check for known limits: mobile width on the RSVP page, empty states, error messages that guests can understand.

## Output
Write docs/CHECK_REPORT.md:
- Date and what was checked
- Commands run and results (pass/fail, with the key error lines)
- Acceptance criteria table: criterion, result, evidence
- Bugs found: id, short title, how to reproduce, expected vs actual, severity (blocker / major / minor)
- Security findings
- Verdict: ready to move on, or not

## Rules
- Do not fix anything in this step. Only find and report. Fixing is /debug.
- Do not say "looks fine" without running it. If you could not run something, say so and why.
- Report failures plainly. Do not soften them.
- Every bug needs steps to reproduce. If you cannot reproduce it, say that.

## Finish with
- Verdict in one line
- Blockers first, then the rest
- Suggested next command (/debug if bugs exist, /sync if clean)
