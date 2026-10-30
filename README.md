# Folio Demo

A local-only investment/depot dashboard for demonstrating reliable Playwright UI/API test automation with deterministic test data, CI reporting and optional Xray integration. All products, identifiers, prices, balances and orders are synthetic. This application does not connect to financial services or execute real trades.

## Features

- Portfolio dashboard with available cash, total value, holdings and recent orders
- Five fictional funds across global equity, European equity, bonds, sustainable equity and balanced categories
- Fund discovery, category filters and product detail screens
- Simulated buy and sell orders with cash and holding validation
- SQLite database automatically created and deterministically seeded on first start
- Stable `data-testid` selectors for important UI elements
- Responsive React/Vite frontend and Express REST API

## Run locally

Requirements: Node.js 22 or newer and npm.

Install dependencies:

```sh
npm install
```

In separate terminals, start the API and frontend:

```sh
npm run api
```

```sh
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Vite proxies `/api` requests to the Express API on port `3000`. To serve the built app from Express instead:

```sh
npm run build
npm start
```

The SQLite database is stored in `server/data/folio-demo.sqlite` by default. Set `DATA_DIR` to use another directory. Removing that database and restarting restores the seeded starting state.

Reset the local synthetic demo account to its starting balance and seeded holdings at any time:

```sh
npm run demo:reset
```

This works while the local API is running and does not affect the separate Playwright test database.

## Docker

Build and run the complete application with Docker Compose:

```sh
docker compose up --build
```

Visit `http://localhost:3000`. The SQLite database is persisted in the `folio-demo-data` volume. No external API or database service is used.

## REST API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Local service status |
| `GET` | `/api/dashboard` | Cash, portfolio value, holdings and recent orders |
| `GET` | `/api/funds` | Synthetic fund catalogue |
| `GET` | `/api/funds/:id` | A fund and its mock details |
| `GET` | `/api/orders` | Simulated order history |
| `POST` | `/api/orders` | Place a simulated buy or sell (`fundId`, `side`, `amount`) |

Amounts in order requests are euros. Orders update only the local demo SQLite database.

## Playwright

Install the matching Chromium browser once:

```sh
npx playwright install chromium
```

### Optional AI-assisted test authoring in VS Code

Requires VS Code 1.105 or newer with Copilot agent mode. If prompted, approve the workspace's local Playwright MCP server. Playwright's planner and generator agents are available through the VS Code Copilot agent picker. The planner can explore the Folio app and draft a focused test plan; after you review it, the generator can verify a scenario in the browser and create a JavaScript Playwright test. Start with the **Playwright Test Planner** agent or the `/playwright-test-plan` prompt, then review the saved plan before using the **Playwright Test Generator** agent or `/playwright-test-generate` prompt.

This is an authoring aid, not AI-driven test execution: normal Playwright assertions still determine pass or fail, and generated tests should be reviewed and run with `npm run test:e2e` before relying on them. The seed test in `tests/seed.spec.ts` prepares the isolated synthetic test app. The normal `npm run test:e2e` and `npm run test:demo` commands exclude it, while the planner can run it when needed. No AI calls are made by either test command.

### Live demo run

```sh
npm run test:demo
```

This builds the app, opens a visible Chromium browser, and runs 12 named browser/API scenarios one at a time. Presentation pacing makes the interactions easier to follow; expect about one minute, depending on your computer. The run prints each result, elapsed time (excluding the build), pass rate, and completed scenarios per minute. The test runner starts its own server on port `4174` with an isolated `.playwright-data` database and resets demo state before each scenario. It does not use or change the app you already have running on ports `3000` and `5173`.

The run covers 12 named browser and API scenarios: starting dashboard data, fund catalogue and filters, fund details, successful and rejected orders, order history, API input errors, and mobile navigation.

When the run finishes, start the local report viewer:

```sh
npm run test:report
```

Open `http://localhost:9323` for the plain-language summary: scenarios executed, pass rate, run time, completed scenarios per minute, and each scenario's result and duration. Select **Open the detailed Playwright report** for Playwright's step-by-step trace. The report is replaced on the next run. Close the report server with `Ctrl+C` in its terminal when finished.

Each completed run is also archived in `test-runs/<UTC timestamp>/`. The archive includes a readable `summary.html`, the detailed Playwright report, JSON and JUnit results, failure context and trace files (when generated), plus `run-info.json` with the run timestamp, mode and exit code. To view an archived report with its detailed-report link working, start `npm run test:report` and open `http://localhost:9323/runs/<UTC timestamp>/summary.html` (replace the placeholder with the folder name under `test-runs`). Archives are kept locally and ignored by Git; delete an individual run folder when it is no longer needed.

For a faster, non-headed run that still updates both reports:

```sh
npm run test:e2e
```

This run also produces the HTML summary and detailed Playwright report. The test-only reset endpoint is enabled only on the isolated Playwright server; it is not enabled by the normal local API or production Docker app.

### Publish results to Jira Cloud with Xray

The GitHub Actions workflow at `.github/workflows/playwright.yml` runs the headless Playwright suite on pushes, pull requests and manual workflow dispatch. It saves the HTML, JSON and JUnit reports as a downloadable workflow artifact. On pushes and manual workflow dispatch, if Xray credentials are configured, it also imports JUnit results into the configured Xray Cloud project. Pull requests still run the tests and save the artifact, but deliberately do not receive Xray credentials.

1. In Xray Cloud, create an API key for a dedicated automation account that has permission to create test executions in the target Jira project. Xray API keys are separate from a Jira user's password or Atlassian API token.
2. In GitHub, open **Settings → Secrets and variables → Actions** for the repository.
3. Add repository **secrets** named `XRAY_CLIENT_ID` and `XRAY_CLIENT_SECRET` using the values generated by Xray. Never add these values to source files, workflow YAML, chat, or `VITE_` frontend variables.
4. Add a repository **variable** named `XRAY_PROJECT_KEY` with the Jira project key (for example, `DEMO`).
5. If the company's Xray Cloud tenant requires a regional API host, add `XRAY_API_BASE_URL` as a repository variable using the HTTPS API base URL provided by the Jira/Xray administrator. The default is `https://xray.cloud.getxray.app/api/v2`.
6. Push a commit or run **Actions → Playwright tests → Run workflow**. The workflow retains its test reports as an artifact and sends the JUnit results to Xray. Pull requests from forks do not receive repository secrets; the Xray upload step safely skips if they are unavailable.

The optional uploader can also be run after a local test run with `npm run xray:upload`; it reads `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`, `XRAY_PROJECT_KEY` and optional `XRAY_API_BASE_URL` from the process environment. With no Xray settings configured it exits successfully and reports that upload was skipped. It never prints the client secret or access token.

For the first trial, use a non-production Jira/Xray project and verify the imported execution and tests in Xray. This starter imports the JUnit outcomes into a new Xray execution in the selected project; it does not yet associate each scenario with pre-existing Jira Test issue keys. Ask the Jira test administrator how this project wants automated scenarios mapped before relying on Jira test-case-level reporting.

### Manual vs automation comparison

For a fair live comparison, first reset the manual app with `npm run demo:reset`, then perform the same checks as the automated run:

1. On the dashboard, verify the starting cash is €50,000.
2. Open funds, filter to Global Equity, then restore All funds.
3. Open Northstar Global Equity and check its ID (`FND-GLB-001`) and mock price (€142.68).
4. Buy €250, verify the dashboard cash becomes €49,750.01.
5. Sell €100 of that holding, verify cash becomes €49,850.00.
6. Confirm the buy and sell both appear in order history.
7. At a mobile viewport (390 px wide), confirm the fund list and Buy button are usable.
8. Review the API validation scenarios in the automated summary; these are service checks rather than manual UI steps.

Time the manual checks from opening the app to completing the last check, and compare with the elapsed time printed by `npm run test:demo`. For a credible presentation, show the actual measured times, repeat each method a few times, and report the median. Keep one-time setup/authoring time separate from repeat execution time; do not present a made-up speed-up. Automation is especially useful for rerunning the same regression checks consistently.

## Lint and build

```sh
npm run lint
npm run build
```
