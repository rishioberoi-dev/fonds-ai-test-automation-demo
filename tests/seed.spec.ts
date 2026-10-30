import { test, expect } from '@playwright/test';

test('seed @seed the Folio dashboard for AI-assisted test planning', async ({ page, request }) => {
  const response = await request.post('/api/test/reset')
  expect(response.ok(), 'test server resets to the seeded portfolio').toBeTruthy()
  await page.goto('/')
  await expect(page.getByTestId('dashboard')).toBeVisible()
});
