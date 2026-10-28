---
description: Write unit, integration or end-to-end tests for the implementation
argument-hint: <feature or file to test>
---

# /test

Write unit, integration, or end-to-end tests for the implementation.

Target: $ARGUMENTS (if empty, test the most recently changed feature)

## Read first
- CLAUDE.md (how to run tests)
- The acceptance criteria in docs/SCOPE.md for this feature
- The rules and routes in docs/ARCHITECTURE.md
- The code being tested

## Do
1. Turn each acceptance criterion into at least one test. Name tests so a failure explains itself, for example: "rejects RSVP when party_size is negative".
2. Pick the right level:
   - Unit (Vitest): pure logic. Confirmed headcount, planning estimate, stale flag, CSV parsing, duplicate detection, veg + nonveg = party_size.
   - Integration (Supertest + test database): API routes, database constraints, auth.
   - End-to-end (Playwright): keep to 1-2 key flows only. Planner creates wedding, imports guests, copies link. Guest opens link and RSVPs. Dashboard shows the update.
3. Security tests are required, not optional:
   - planner A cannot read, edit or delete planner B's wedding (expect 403 or 404)
   - a wrong or missing invite token is rejected
   - one household's token cannot read or change another household's RSVP
   - invalid input (negative numbers, huge strings, wrong types) is rejected
   - CSV export neutralises cells starting with = + - @
   - rate limit returns 429 after repeated attempts
4. Include edge cases: empty guest list, duplicate guests, guest changes RSVP twice, household not invited to a function, maybe-only dashboard.
5. Tests must be independent. Each one sets up its own data and cleans up.

## Rules
- Test behaviour, not internal details.
- No tests that always pass. Each test must fail if the feature breaks. Check this by breaking the code on purpose once, then restoring it.
- Do not change application code to make a test pass. If you find a bug, report it and leave it for /debug.
- Do not use real guest data. Use made-up data.
- Keep the suite fast. Slow tests will not get run.

## Finish with
- Test files added and what they cover
- Which acceptance criteria are covered and which are not
- Any bugs found while writing tests
- Suggested next command (usually /check)
