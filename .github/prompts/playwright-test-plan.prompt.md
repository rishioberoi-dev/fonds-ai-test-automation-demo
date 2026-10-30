---
agent: playwright-test-planner
description: Plan test coverage for a Folio feature
---

Create a focused Playwright test plan for this Folio feature:

- Feature: ${input:feature:Describe the behavior or requirement}
- Seed file: `tests/seed.spec.ts`
- Existing coverage: `tests/demo.spec.js`
- Test plan: `specs/${input:planFile:folio-feature}.md`

Prefer meaningful uncovered behavior, include expected outcomes, and keep the plan limited to scenarios that provide distinct value.
