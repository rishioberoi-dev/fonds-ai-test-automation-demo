import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = process.env.DATA_DIR || path.join(here, 'data')
fs.mkdirSync(dataDirectory, { recursive: true })

export const db = new Database(path.join(dataDirectory, 'folio-demo.sqlite'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS funds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    risk_level INTEGER NOT NULL,
    description TEXT NOT NULL,
    long_description TEXT NOT NULL,
    color_index INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS account (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cash_balance REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS holdings (
    fund_id TEXT PRIMARY KEY REFERENCES funds(id),
    units REAL NOT NULL CHECK (units >= 0)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id TEXT NOT NULL REFERENCES funds(id),
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    amount REAL NOT NULL CHECK (amount > 0),
    units REAL NOT NULL CHECK (units > 0),
    created_at TEXT NOT NULL
  );
`)

const seedFunds = [
  {
    id: 'FND-GLB-001',
    name: 'Northstar Global Equity',
    shortName: 'NG',
    category: 'Global Equity',
    price: 142.68,
    riskLevel: 5,
    description: 'A fictional global equity fund for exploring the demo experience.',
    longDescription: 'Northstar Global Equity is a wholly fictional product in this testing environment. Its synthetic portfolio description and mock price exist only to support repeatable demonstrations of fund discovery and order workflows.',
  },
  {
    id: 'FND-EUR-002',
    name: 'Alpine European Equity',
    shortName: 'AE',
    category: 'European Equity',
    price: 87.42,
    riskLevel: 4,
    description: 'A fictional European equity collection with illustrative pricing.',
    longDescription: 'Alpine European Equity is a made-up fund for testing. The product does not track a real market, security, index or investment strategy.',
  },
  {
    id: 'FND-BND-003',
    name: 'Stillwater Bond Fund',
    shortName: 'SB',
    category: 'Bonds',
    price: 103.15,
    riskLevel: 2,
    description: 'A fictional bond fund built from deterministic demo data.',
    longDescription: 'Stillwater Bond Fund is a synthetic product. Its fixed mock price and category are provided solely for local application and Playwright demonstrations.',
  },
  {
    id: 'FND-SUS-004',
    name: 'Evergreen Sustainable Equity',
    shortName: 'ES',
    category: 'Sustainable Equity',
    price: 96.40,
    riskLevel: 5,
    description: 'A fictional sustainable equity fund for demo purposes.',
    longDescription: 'Evergreen Sustainable Equity is an invented fund name and does not describe an actual sustainable investment product. All details are synthetic.',
  },
  {
    id: 'FND-BAL-005',
    name: 'Harbor Balanced Fund',
    shortName: 'HB',
    category: 'Balanced Fund',
    price: 118.75,
    riskLevel: 3,
    description: 'A fictional balanced fund with a stable mock price.',
    longDescription: 'Harbor Balanced Fund is a non-investable demo product. Its descriptive text and price are static synthetic content, not financial information.',
  },
]

const insertFund = db.prepare(`
  INSERT OR IGNORE INTO funds
  (id, name, short_name, category, price, risk_level, description, long_description, color_index)
  VALUES (@id, @name, @shortName, @category, @price, @riskLevel, @description, @longDescription, @colorIndex)
`)
const seed = db.transaction(() => {
  seedFunds.forEach((fund, colorIndex) => insertFund.run({ ...fund, colorIndex }))
  db.prepare('INSERT OR IGNORE INTO account (id, cash_balance) VALUES (1, 50000)').run()
  const insertHolding = db.prepare('INSERT OR IGNORE INTO holdings (fund_id, units) VALUES (?, ?)')
  insertHolding.run('FND-GLB-001', 12.5)
  insertHolding.run('FND-BND-003', 30)
  insertHolding.run('FND-SUS-004', 8)
  db.prepare(`
    INSERT INTO orders (fund_id, side, amount, units, created_at)
    SELECT 'FND-GLB-001', 'buy', 1783.50, 12.5, '2026-01-15T10:30:00.000Z'
    WHERE NOT EXISTS (SELECT 1 FROM orders)
  `).run()
})
seed()

export function resetDemoState() {
  const reset = db.transaction(() => {
    db.prepare('DELETE FROM orders').run()
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'orders'").run()
    db.prepare('DELETE FROM holdings').run()
    db.prepare('UPDATE account SET cash_balance = 50000 WHERE id = 1').run()
    const insertHolding = db.prepare('INSERT INTO holdings (fund_id, units) VALUES (?, ?)')
    insertHolding.run('FND-GLB-001', 12.5)
    insertHolding.run('FND-BND-003', 30)
    insertHolding.run('FND-SUS-004', 8)
    db.prepare(`
      INSERT INTO orders (fund_id, side, amount, units, created_at)
      VALUES ('FND-GLB-001', 'buy', 1783.50, 12.5, '2026-01-15T10:30:00.000Z')
    `).run()
  })
  reset()
}

export function getFund(id) {
  return db.prepare('SELECT * FROM funds WHERE id = ?').get(id)
}

export function toFund(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    category: row.category,
    price: row.price,
    riskLevel: row.risk_level,
    description: row.description,
    longDescription: row.long_description,
    colorIndex: row.color_index,
  }
}

export function toOrder(row) {
  return {
    id: row.id,
    fundId: row.fund_id,
    fundName: row.fund_name,
    side: row.side,
    amount: row.amount,
    units: row.units,
    createdAt: row.created_at,
  }
}

export function getDashboard() {
  const holdings = db.prepare(`
    SELECT f.*, h.units, ROUND(f.price * h.units, 2) AS value
    FROM holdings h JOIN funds f ON f.id = h.fund_id
    WHERE h.units > 0 ORDER BY f.name
  `).all().map((row) => ({ ...toFund(row), fundId: row.id, units: row.units, value: row.value }))
  const cashBalance = db.prepare('SELECT cash_balance FROM account WHERE id = 1').get().cash_balance
  const investedValue = holdings.reduce((sum, holding) => sum + holding.value, 0)
  const recentOrders = db.prepare(`
    SELECT o.*, f.name AS fund_name FROM orders o
    JOIN funds f ON f.id = o.fund_id ORDER BY o.id DESC LIMIT 10
  `).all().map(toOrder)
  return {
    cashBalance: roundMoney(cashBalance),
    investedValue: roundMoney(investedValue),
    totalPortfolioValue: roundMoney(cashBalance + investedValue),
    holdings,
    recentOrders,
  }
}

export const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100
