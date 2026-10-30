import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const resultsPath = path.resolve('test-results/demo-results.json')
const summaryPath = path.resolve('playwright-report/demo-summary.html')
const start = performance.now()
const startedAtDate = new Date()
const startedAt = startedAtDate.toLocaleString()
const runId = startedAtDate.toISOString().replace(/[:.]/g, '-')
const archivePath = path.resolve('test-runs', runId)
const headless = process.argv.includes('--headless')

console.log(headless
  ? '\nStarting the headless Playwright run.\n'
  : '\nStarting the visible Folio test demo. Watch Chromium and the test names below.\n')

const runnerEnv = { ...process.env }
if (headless) {
  delete runnerEnv.FOLIO_DEMO_MODE
} else {
  runnerEnv.FOLIO_DEMO_MODE = '1'
}
const runner = spawn(
  process.execPath,
  [
    'node_modules/@playwright/test/cli.js',
    'test',
    ...(headless ? [] : ['--headed']),
    '--workers=1',
    '--grep-invert',
    '@seed',
  ],
  {
    env: runnerEnv,
    stdio: 'inherit',
  },
)

runner.on('error', (error) => {
  console.error(`Could not start Playwright: ${error.message}`)
  process.exitCode = 1
})

runner.on('exit', async (code, signal) => {
  const commandSeconds = (performance.now() - start) / 1000
  console.log(`\nPlaywright run finished in ${commandSeconds.toFixed(1)} seconds (build time excluded).`)

  try {
    const report = JSON.parse(await fs.readFile(resultsPath, 'utf8'))
    const cases = collectCases(report.suites || [])
    const counts = {
      passed: cases.filter((item) => item.status === 'passed' && !item.flaky).length,
      flaky: cases.filter((item) => item.flaky).length,
      failed: cases.filter((item) => item.status !== 'passed' && item.status !== 'skipped').length,
      skipped: cases.filter((item) => item.status === 'skipped').length,
    }
    const executed = counts.passed + counts.flaky + counts.failed
    const passPercent = executed ? Math.round(((counts.passed + counts.flaky) / executed) * 100) : 0
    const casesPerMinute = commandSeconds > 0 ? (executed / (commandSeconds / 60)).toFixed(1) : '0.0'
    const totalCaseSeconds = cases.reduce((total, item) => total + item.duration, 0)

    await fs.mkdir(path.dirname(summaryPath), { recursive: true })
    const summary = {
      cases,
      counts,
      executed,
      passPercent,
      casesPerMinute,
      commandSeconds,
      totalCaseSeconds,
      startedAt,
    }
    await fs.writeFile(summaryPath, renderSummary(summary))
    await fs.mkdir(path.dirname(archivePath), { recursive: true })
    await fs.mkdir(archivePath, { recursive: false })
    await Promise.all([
      fs.cp(path.dirname(resultsPath), path.join(archivePath, 'test-results'), { recursive: true }),
      fs.cp(path.dirname(summaryPath), path.join(archivePath, 'playwright-report'), { recursive: true }),
    ])
    await fs.writeFile(path.join(archivePath, 'summary.html'), renderSummary(summary, './playwright-report/'))
    await fs.writeFile(path.join(archivePath, 'run-info.json'), `${JSON.stringify({
      runId,
      startedAt: startedAtDate.toISOString(),
      durationSeconds: Number(commandSeconds.toFixed(1)),
      headless,
      exitCode: signal ? null : code,
    }, null, 2)}\n`)

    console.log(`Results: ${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${counts.skipped} skipped.`)
    console.log(`Throughput: ${casesPerMinute} test cases per minute across ${executed} executed scenarios.`)
    console.log('Human-readable report: run "npm run test:report".')
    console.log(`Archived run: ${path.relative(process.cwd(), archivePath)}`)
  } catch (error) {
    console.error(`Could not create the human-readable report: ${error.message}`)
    process.exitCode = 1
  }

  if (signal) {
    console.error(`Playwright stopped by signal ${signal}.`)
    process.exitCode = 1
  } else if (code !== 0) {
    process.exitCode = code ?? 1
  }
})

function collectCases(suites) {
  const cases = []
  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const results = test.results || []
        const finalResult = results.at(-1)
        const status = finalResult?.status || 'skipped'
        cases.push({
          title: spec.title,
          status,
          duration: results.reduce((sum, result) => sum + (result.duration || 0), 0) / 1000,
          flaky: status === 'passed' && results.some((result) => result.status !== 'passed'),
          error: finalResult?.error?.message?.split('\n')[0] || '',
        })
      }
    }
    cases.push(...collectCases(suite.suites || []))
  }
  return cases
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function renderSummary(summary, detailsHref = '/details/') {
  const { cases, counts, executed, passPercent, casesPerMinute, commandSeconds, totalCaseSeconds, startedAt } = summary
  const statusLabel = (item) => item.flaky ? 'Passed after retry' : item.status === 'passed' ? 'Passed' : item.status === 'skipped' ? 'Skipped' : 'Failed'
  const statusClass = (item) => item.flaky ? 'flaky' : item.status === 'passed' ? 'passed' : item.status === 'skipped' ? 'skipped' : 'failed'
  const summaryMessage = counts.failed
    ? 'Review needed'
    : counts.flaky
      ? 'Some scenarios needed a retry'
      : 'All scenarios passed'
  const summaryClass = counts.failed ? 'fail' : counts.flaky ? 'caution' : ''
  const rows = cases.map((item, index) => `
    <tr>
      <td class="number">${String(index + 1).padStart(2, '0')}</td>
      <td><strong>${escapeHtml(item.title)}</strong>${item.error ? `<p class="failure">${escapeHtml(item.error)}</p>` : ''}</td>
      <td><span class="badge ${statusClass(item)}">${statusLabel(item)}</span></td>
      <td class="duration">${item.duration.toFixed(2)} sec</td>
    </tr>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f5f6fa">
  <title>Folio demo — test run summary</title>
  <style>
    :root{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#25283a;background:#f5f6fa;font-synthesis:none;text-rendering:optimizeLegibility}
    *{box-sizing:border-box}body{margin:0}.wrap{max-width:1120px;margin:0 auto;padding:36px 26px 52px}
    .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px}.brand{display:flex;align-items:center;gap:11px;font-size:15px;font-weight:700}.mark{display:grid;width:34px;height:34px;place-items:center;border-radius:11px 11px 11px 4px;background:#6258d9;color:white;font-size:23px}
    .tag{padding:7px 10px;border:1px solid #e1e3eb;border-radius:99px;background:white;color:#737789;font-size:11px}.tag i{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#53ad82}
    .intro{margin-bottom:24px}.eyebrow{color:#7774c9;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase}h1{margin:8px 0;color:#282b3c;font-size:30px;letter-spacing:-.7px}.intro p{max-width:760px;margin:0;color:#74798a;font-size:14px;line-height:1.6}
    .summary{display:flex;align-items:center;gap:10px;margin:20px 0;padding:15px 17px;border:1px solid #d8ecdf;border-radius:10px;background:#f0faf3;color:#357c55;font-size:14px}.summary.fail{border-color:#f1d7d2;background:#fff5f3;color:#a8483b}.summary.caution{border-color:#f1e4bb;background:#fffaf0;color:#8a6b22}.summary strong{font-size:16px}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin:17px 0 28px}.metric{padding:17px 18px;border:1px solid #e7e8ef;border-radius:10px;background:#fff}.metric span{display:block;color:#828697;font-size:11px}.metric strong{display:block;margin-top:8px;color:#303447;font-size:25px;letter-spacing:-.5px}.metric small{display:block;margin-top:5px;color:#9a9eaa;font-size:10px}
    .section-heading{display:flex;align-items:end;justify-content:space-between;gap:15px;margin:27px 0 12px}.section-heading h2{margin:0;color:#343749;font-size:16px}.section-heading p{margin:4px 0 0;color:#8c90a0;font-size:11px}
    .table-wrap{overflow:hidden;border:1px solid #e7e8ef;border-radius:10px;background:white}table{width:100%;border-collapse:collapse;text-align:left}th{padding:12px 15px;background:#fafafd;color:#9195a3;font-size:9px;letter-spacing:.8px;text-transform:uppercase}td{padding:14px 15px;border-top:1px solid #f0f1f5;color:#535869;font-size:12px;vertical-align:top}.number{width:54px;color:#999dab;font-size:10px}.duration{width:105px;color:#626779;white-space:nowrap}.badge{display:inline-block;padding:5px 8px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap}.passed{background:#e8f6ed;color:#348052}.failed{background:#fff0ed;color:#b3483d}.flaky{background:#fff5dc;color:#946d1b}.skipped{background:#f0f1f5;color:#74798a}.failure{max-width:650px;margin:7px 0 0;color:#ab4d41;font-size:10px;line-height:1.5;overflow-wrap:anywhere}
    .note{margin-top:22px;padding:14px 16px;border:1px solid #e8e8f0;border-radius:9px;background:#fff;color:#777c8d;font-size:11px;line-height:1.6}.note strong{color:#45495a}.details{display:inline-block;margin-top:16px;color:#5e56cb;font-size:12px;font-weight:600;text-decoration:none}.details:hover{text-decoration:underline}.footer{margin-top:22px;color:#a0a3ae;font-size:10px}
    @media(max-width:700px){.wrap{padding:22px 14px}.top{margin-bottom:24px}h1{font-size:24px}.metrics{grid-template-columns:repeat(2,1fr);gap:9px}.metric{padding:14px}.metric strong{font-size:21px}.table-wrap{overflow-x:auto}table{min-width:620px}.tag{font-size:9px}}
  </style>
</head>
<body>
  <main class="wrap">
    <div class="top"><div class="brand"><span class="mark">f</span> Folio demo <span style="color:#9296a4;font-weight:400">/ automation results</span></div><span class="tag"><i></i>Local synthetic demo</span></div>
    <header class="intro"><div class="eyebrow">Playwright test run · ${escapeHtml(startedAt)}</div><h1>Test results at a glance</h1><p>Each row is a real browser or API scenario. The checks use synthetic demo data and run automatically in Chromium; no real financial transactions occur.</p></header>
    <div class="summary ${summaryClass}"><strong>${summaryMessage}</strong><span>— ${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} passed after retry, ${counts.skipped} skipped.</span></div>
    <section class="metrics" aria-label="Run summary metrics">
      <article class="metric"><span>Scenarios executed</span><strong>${executed}</strong><small>${cases.length} total in this run</small></article>
      <article class="metric"><span>Pass rate</span><strong>${passPercent}%</strong><small>Passed on final attempt</small></article>
      <article class="metric"><span>Run time</span><strong>${commandSeconds.toFixed(1)} sec</strong><small>Build time excluded</small></article>
      <article class="metric"><span>Scenarios per minute</span><strong>${casesPerMinute}</strong><small>${totalCaseSeconds.toFixed(1)} sec combined test time</small></article>
    </section>
    <section>
      <div class="section-heading"><div><h2>What was checked</h2><p>Plain-language summaries of the automated user journeys and API checks.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Scenario</th><th>Result</th><th>Test time</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>
    <div class="note"><strong>How to read these numbers:</strong> “Scenarios per minute” is the number of completed test cases divided by the measured Playwright run time, excluding the build. It describes this run only; it is not a manual-vs-automation speed-up claim. The combined test time is the sum of individual scenario durations and may differ from wall-clock run time.</div>
    <a class="details" href="${escapeHtml(detailsHref)}">Open the detailed Playwright report →</a>
    <div class="footer">Generated locally from Playwright results · ${executed} executed scenarios · ${counts.failed} failures</div>
  </main>
</body>
</html>`
}
