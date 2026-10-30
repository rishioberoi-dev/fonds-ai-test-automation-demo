---
agent: playwright-test-generator
description: Generate a Playwright test from a reviewed Folio plan
---

Generate the reviewed scenario from this test plan:

- Plan: `specs/${input:planFile:folio-feature}.md`
- Scenario: ${input:scenario:Scenario title or plan section}
- Test file: `tests/${input:fileName:ai-generated}.spec.js`

Keep the test independent, use the synthetic test reset endpoint, and match the existing suite's JavaScript style. Do not edit app code or weaken assertions.
