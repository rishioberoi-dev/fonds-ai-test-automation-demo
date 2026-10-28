import fs from 'node:fs/promises'

const clientId = process.env.XRAY_CLIENT_ID
const clientSecret = process.env.XRAY_CLIENT_SECRET
const projectKey = process.env.XRAY_PROJECT_KEY
const reportPath = process.env.XRAY_JUNIT_PATH || 'test-results/junit.xml'
const configuredValues = [clientId, clientSecret, projectKey].filter(Boolean).length

if (configuredValues === 0) {
  console.log('Xray upload skipped: configure XRAY_CLIENT_ID, XRAY_CLIENT_SECRET and XRAY_PROJECT_KEY as CI secrets/variables.')
  process.exit(0)
}

if (!clientId || !clientSecret || !projectKey) {
  console.error('Xray upload not configured: all of XRAY_CLIENT_ID, XRAY_CLIENT_SECRET and XRAY_PROJECT_KEY are required.')
  process.exit(1)
}

if (!/^[A-Z][A-Z0-9_]*$/.test(projectKey)) {
  console.error('Xray upload not started: XRAY_PROJECT_KEY must be a Jira project key (uppercase letters, digits and underscores).')
  process.exit(1)
}

const baseUrl = process.env.XRAY_API_BASE_URL || 'https://xray.cloud.getxray.app/api/v2'
let parsedBaseUrl
try {
  parsedBaseUrl = new URL(baseUrl)
} catch {
  console.error('Xray upload not started: XRAY_API_BASE_URL must be a valid HTTPS URL.')
  process.exit(1)
}
if (parsedBaseUrl.protocol !== 'https:') {
  console.error('Xray upload not started: Xray API URL must use HTTPS.')
  process.exit(1)
}

let junitXml
try {
  junitXml = await fs.readFile(reportPath)
} catch {
  console.error(`Xray upload not started: JUnit results file was not found at "${reportPath}". Run the Playwright suite first.`)
  process.exit(1)
}

const apiBase = baseUrl.replace(/\/+$/, '')
try {
  const authResponse = await fetch(`${apiBase}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
  if (!authResponse.ok) {
    console.error(`Xray authentication failed (HTTP ${authResponse.status}). Check the Xray API credentials and Xray Cloud region.`)
    process.exit(1)
  }

  const authPayload = await authResponse.json()
  const token = typeof authPayload === 'string' ? authPayload : authPayload?.token
  if (typeof token !== 'string' || token.length === 0) {
    console.error('Xray authentication response did not contain an access token.')
    process.exit(1)
  }

  const form = new FormData()
  form.append('file', new Blob([junitXml], { type: 'application/xml' }), 'junit.xml')
  const importUrl = new URL(`${apiBase}/import/execution/junit`)
  importUrl.searchParams.set('projectKey', projectKey)

  const importResponse = await fetch(importUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!importResponse.ok) {
    console.error(`Xray result import failed (HTTP ${importResponse.status}). Check the project key, Xray permissions and JUnit report.`)
    process.exit(1)
  }

  console.log(`Xray accepted the JUnit results for Jira project ${projectKey} (HTTP ${importResponse.status}).`)
  console.log('Open Xray in Jira to review the created test execution and imported outcomes.')
} catch (error) {
  console.error(`Xray upload failed: ${error.message}`)
  process.exit(1)
}
