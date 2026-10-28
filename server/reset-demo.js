import { db, resetDemoState } from './database.js'

try {
  resetDemoState()
  console.log('Demo account reset to its deterministic starting state.')
} finally {
  db.close()
}
