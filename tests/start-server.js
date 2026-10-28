import fs from 'node:fs'
import path from 'node:path'

const dataDirectory = path.resolve(process.env.DATA_DIR || '.playwright-data')
fs.mkdirSync(dataDirectory, { recursive: true })
for (const file of ['folio-demo.sqlite', 'folio-demo.sqlite-shm', 'folio-demo.sqlite-wal']) {
  const filePath = path.join(dataDirectory, file)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

await import('../server/index.js')
