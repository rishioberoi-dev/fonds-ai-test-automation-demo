import { expect, test } from '@playwright/test'

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/test/reset')
  expect(response.ok(), 'test server resets to the same starting portfolio').toBeTruthy()
})

test.afterEach(async ({ page }) => {
  if (process.env.FOLIO_DEMO_MODE === '1') {
    await page.waitForTimeout(1200)
  }
})

test('Dashboard shows €50,000 cash, three holdings and one seeded order', async ({ page }) => {
  await test.step('Open the dashboard and check the seeded portfolio', async () => {
    await page.goto('/')
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('cash-balance')).toHaveText('€50,000.00')
    await expect(page.getByTestId('portfolio-value')).toHaveText('€55,649.20')
    await expect(page.locator('[data-testid^="holding-"]')).toHaveCount(3)
    await expect(page.getByTestId('view-all-orders')).toBeVisible()
  })
})

test('Fund catalogue shows five products and filters Global Equity', async ({ page }) => {
  await test.step('Open the fund catalogue and confirm all five mock funds', async () => {
    await page.goto('/')
    await page.getByTestId('nav-funds').click()
    await expect(page.getByTestId('fund-list').locator('.fund-card')).toHaveCount(5)
  })
  await test.step('Filter by Global Equity, then restore the full catalogue', async () => {
    await page.getByTestId('filter-global-equity').click()
    await expect(page.getByTestId('fund-list').locator('.fund-card')).toHaveCount(1)
    await expect(page.getByTestId('fund-card-FND-GLB-001')).toBeVisible()
    await page.getByTestId('filter-all-funds').click()
    await expect(page.getByTestId('fund-list').locator('.fund-card')).toHaveCount(5)
  })
})

test('Fund details show the synthetic product ID, price and risk level', async ({ page }) => {
  await test.step('Open Northstar Global Equity from the fund catalogue', async () => {
    await page.goto('/')
    await page.getByTestId('nav-funds').click()
    await page.getByTestId('fund-card-FND-GLB-001').getByRole('button', { name: /view details/i }).click()
  })
  await test.step('Check identifying and mock pricing information', async () => {
    await expect(page.getByTestId('fund-details')).toBeVisible()
    await expect(page.getByTestId('fund-product-id')).toHaveText('FND-GLB-001')
    await expect(page.getByTestId('fund-price')).toHaveText('€142.68')
    await expect(page.getByText('Level 5 of 7')).toBeVisible()
  })
})

test('Buying €250 reduces cash and adds units to the holding', async ({ page }) => {
  await test.step('Choose Northstar Global Equity and submit a €250 buy order', async () => {
    await page.goto('/')
    await page.getByTestId('nav-funds').click()
    await page.getByTestId('buy-fund-FND-GLB-001').click()
    await page.getByTestId('order-amount').fill('250')
    await page.getByTestId('buy-button').click()
    await expect(page.getByTestId('order-success')).toBeVisible()
  })
  await test.step('Check the new cash balance and updated holding', async () => {
    await page.getByTestId('nav-dashboard').click()
    await expect(page.getByTestId('cash-balance')).toHaveText('€49,750.01')
    await expect(page.getByTestId('holding-FND-GLB-001')).toContainText('14.25')
  })
})

test('Selling €100 of an owned fund returns cash to the account', async ({ page }) => {
  await test.step('Sell part of the seeded Northstar holding', async () => {
    await page.goto('/')
    await page.getByTestId('sell-holding-FND-GLB-001').click()
    await page.getByTestId('order-amount').fill('100')
    await page.getByTestId('sell-button').click()
    await expect(page.getByTestId('order-success')).toBeVisible()
  })
  await test.step('Check the proceeds and remaining units', async () => {
    await page.getByTestId('nav-dashboard').click()
    await expect(page.getByTestId('cash-balance')).toHaveText('€50,099.99')
    await expect(page.getByTestId('holding-FND-GLB-001')).toContainText('11.80')
  })
})

test('An unaffordable buy is blocked without changing the cash balance', async ({ page }) => {
  await test.step('Try to buy more than the available demo cash', async () => {
    await page.goto('/')
    await page.getByTestId('nav-funds').click()
    await page.getByTestId('buy-fund-FND-GLB-001').click()
    await page.getByTestId('order-amount').fill('60000')
    await page.getByTestId('buy-button').click()
    await expect(page.getByTestId('order-error')).toContainText('Insufficient available cash')
  })
  await test.step('Confirm the account balance is unchanged', async () => {
    await page.getByTestId('close-order').click()
    await page.getByTestId('nav-dashboard').click()
    await expect(page.getByTestId('cash-balance')).toHaveText('€50,000.00')
  })
})

test('A sale larger than the owned position is blocked', async ({ page }) => {
  await test.step('Try selling more fund units than the portfolio holds', async () => {
    await page.goto('/')
    await page.getByTestId('sell-holding-FND-GLB-001').click()
    await page.getByTestId('order-amount').fill('10000')
    await page.getByTestId('sell-button').click()
    await expect(page.getByTestId('order-error')).toContainText('not have enough units')
  })
  await test.step('Confirm no cash was added by the rejected sale', async () => {
    await expect(page.getByTestId('cash-balance')).toHaveText('€50,000.00')
  })
})

test('Order history lists new buys and sells as completed', async ({ page }) => {
  await test.step('Place one buy and one sell order', async () => {
    await page.goto('/')
    await page.getByTestId('nav-funds').click()
    await page.getByTestId('buy-fund-FND-GLB-001').click()
    await page.getByTestId('order-amount').fill('250')
    await page.getByTestId('buy-button').click()
    await expect(page.getByTestId('order-success')).toBeVisible()
    await page.getByTestId('nav-dashboard').click()
    await page.getByTestId('sell-holding-FND-GLB-001').click()
    await page.getByTestId('order-amount').fill('100')
    await page.getByTestId('sell-button').click()
    await expect(page.getByTestId('order-success')).toBeVisible()
  })
  await test.step('Check both transaction types appear in order history', async () => {
    await page.getByTestId('nav-orders').click()
    await expect(page.getByTestId('orders-page')).toBeVisible()
    await expect(page.getByTestId('order-row-2').getByText('Buy')).toBeVisible()
    await expect(page.getByTestId('order-row-3').getByText('Sell')).toBeVisible()
    await expect(page.getByTestId('order-row-2').getByText('Completed')).toBeVisible()
    await expect(page.getByTestId('order-row-3').getByText('Completed')).toBeVisible()
  })
})

test('API rejects an invalid order amount with a clear error', async ({ request }) => {
  await test.step('Submit a zero-value buy request to the local API', async () => {
    const response = await request.post('/api/orders', {
      data: { fundId: 'FND-GLB-001', side: 'buy', amount: 0 },
    })
    expect(response.status()).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Enter a valid fund, order type and positive amount.',
    })
  })
})

test('API reports an unknown synthetic fund as not found', async ({ request }) => {
  await test.step('Request a product ID that is not in the demo catalogue', async () => {
    const response = await request.get('/api/funds/NOT-A-REAL-FUND')
    expect(response.status()).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: 'Fund not found.' })
  })
})

test('Mobile layout lets a visitor browse funds and open an order form', async ({ page }) => {
  await test.step('Set a phone-sized viewport and open fund discovery', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('nav-funds')).toBeVisible()
    await page.getByTestId('nav-funds').click()
    await expect(page.getByTestId('fund-card-FND-GLB-001')).toBeVisible()
    await expect(page.getByTestId('buy-fund-FND-GLB-001')).toBeVisible()
  })
  await test.step('Open the buy form and check it fits on screen', async () => {
    await page.getByTestId('buy-fund-FND-GLB-001').click()
    await expect(page.getByTestId('order-dialog')).toBeVisible()
    await expect(page.getByTestId('order-amount')).toBeVisible()
  })
})

test('Mobile navigation switches between dashboard, funds and orders', async ({ page }) => {
  await test.step('Use the mobile navigation to visit each main screen', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('dashboard')).toBeVisible()
    await page.getByTestId('nav-funds').click()
    await expect(page.getByTestId('fund-overview')).toBeVisible()
    await page.getByTestId('nav-orders').click()
    await expect(page.getByTestId('orders-page')).toBeVisible()
  })
})
