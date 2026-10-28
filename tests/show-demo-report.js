import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const summaryFile = path.join(root, 'playwright-report', 'demo-summary.html')
const detailsDirectory = path.join(root, 'playwright-report')
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}
const port = Number(process.env.REPORT_PORT) || 9323

if (!fs.existsSync(summaryFile)) {
  console.error('No demo summary found. Run "npm.cmd run test:demo" first.')
  process.exit(1)
}

http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`)
  if (url.pathname === '/' || url.pathname === '/index.html') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    fs.createReadStream(summaryFile).pipe(response)
    return
  }

  if (url.pathname.startsWith('/details/')) {
    const relativePath = decodeURIComponent(url.pathname.slice('/details/'.length))
    const filePath = path.resolve(detailsDirectory, relativePath || 'index.html')
    if (filePath !== detailsDirectory && !filePath.startsWith(`${detailsDirectory}${path.sep}`)) {
      response.writeHead(403).end('Forbidden')
      return
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end('Report file not found')
      return
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(response)
    return
  }

  response.writeHead(404).end('Not found')
}).listen(port, '127.0.0.1', () => {
  console.log(`Human-readable test summary: http://localhost:${port}`)
  console.log(`Detailed Playwright report: http://localhost:${port}/details/`)
  console.log('Press Ctrl+C to stop the local report server.')
})
