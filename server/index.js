import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, getDashboard, getFund, resetDemoState, roundMoney, toFund, toOrder } from './database.js'

const app = express()
const port = Number(process.env.PORT) || 3000
const here = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(here, '..', 'dist')

app.use(express.json({ limit: '10kb' }))

app.get('/api/health', (_request, response) => response.json({ status: 'ok', mode: 'synthetic-demo' }))

app.get('/api/funds', (_request, response) => {
  const funds = db.prepare('SELECT * FROM funds ORDER BY rowid').all().map(toFund)
  response.json(funds)
})

app.get('/api/funds/:id', (request, response) => {
  const fund = getFund(request.params.id)
  if (!fund) return response.status(404).json({ error: 'Fund not found.' })
  return response.json(toFund(fund))
})

app.get('/api/dashboard', (_request, response) => response.json(getDashboard()))

app.get('/api/orders', (_request, response) => {
  const orders = db.prepare(`
    SELECT o.*, f.name AS fund_name FROM orders o
    JOIN funds f ON f.id = o.fund_id ORDER BY o.id DESC
  `).all().map(toOrder)
  response.json(orders)
})

if (process.env.ENABLE_DEMO_TEST_RESET === 'true') {
  app.post('/api/test/reset', (_request, response) => {
    resetDemoState()
    response.json({ status: 'reset' })
  })
}

app.post('/api/orders', (request, response, next) => {
  const { fundId, side, amount } = request.body || {}
  if (typeof fundId !== 'string' || !['buy', 'sell'].includes(side) ||
      typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return response.status(400).json({ error: 'Enter a valid fund, order type and positive amount.' })
  }
  if (amount > 1000000) return response.status(400).json({ error: 'Demo orders cannot exceed €1,000,000.' })

  const fund = getFund(fundId)
  if (!fund) return response.status(404).json({ error: 'Fund not found.' })
  const requestedAmount = roundMoney(amount)
  if (requestedAmount <= 0) return response.status(400).json({ error: 'Order amount must be at least €0.01.' })
  const units = Math.floor((requestedAmount / fund.price) * 10000) / 10000
  const actualAmount = roundMoney(units * fund.price)
  if (units <= 0 || actualAmount <= 0) {
    return response.status(400).json({ error: 'Order amount is too small to purchase any fund units.' })
  }

  const account = db.prepare('SELECT cash_balance FROM account WHERE id = 1').get()
  const holding = db.prepare('SELECT units FROM holdings WHERE fund_id = ?').get(fundId)
  if (side === 'buy' && actualAmount > account.cash_balance) {
    return response.status(400).json({ error: 'Insufficient available cash for this demo order.' })
  }
  if (side === 'sell' && (!holding || units > holding.units)) {
    return response.status(400).json({ error: 'You do not have enough units of this fund to sell.' })
  }

  try {
    const placeOrder = db.transaction(() => {
      db.prepare('UPDATE account SET cash_balance = cash_balance + ? WHERE id = 1')
        .run(side === 'buy' ? -actualAmount : actualAmount)
      if (side === 'buy') {
        db.prepare(`
          INSERT INTO holdings (fund_id, units) VALUES (?, ?)
          ON CONFLICT(fund_id) DO UPDATE SET units = units + excluded.units
        `).run(fundId, units)
      } else {
        db.prepare('UPDATE holdings SET units = MAX(0, units - ?) WHERE fund_id = ?').run(units, fundId)
      }
      const result = db.prepare(`
        INSERT INTO orders (fund_id, side, amount, units, created_at) VALUES (?, ?, ?, ?, ?)
      `).run(fundId, side, actualAmount, units, new Date().toISOString())
      return db.prepare(`
        SELECT o.*, f.name AS fund_name FROM orders o
        JOIN funds f ON f.id = o.fund_id WHERE o.id = ?
      `).get(result.lastInsertRowid)
    })
    return response.status(201).json({ order: toOrder(placeOrder()) })
  } catch (error) {
    return next(error)
  }
})

app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found.' }))

app.use(express.static(distDirectory))
app.get('/{*path}', (_request, response, next) => {
  response.sendFile(path.join(distDirectory, 'index.html'), (error) => {
    if (error) next(error)
  })
})

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON.' })
  }
  console.error(error)
  return response.status(500).json({ error: 'The demo service encountered an unexpected error.' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Folio demo server listening on http://localhost:${port}`)
})
