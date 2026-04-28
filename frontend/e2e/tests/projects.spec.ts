import { test, expect } from '../fixtures/auth.fixture'

test.describe('Projects Page', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/projects')
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 })
  })

  test('page heading shows "Projects"', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="app-shell"]').getByRole('heading', { name: /Projects/i })).toBeVisible()
  })

  test('projects table renders with column headers', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Progress' })).toBeVisible()
  })

  test('mock projects are shown in the table', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('clicking a table row navigates to project details', async ({ authenticatedPage: page }) => {
    // Click the "View" button on the first row (more reliable than row onClick)
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.getByRole('button', { name: /View/i }).click()
    await expect(page).toHaveURL(/\/projects\//)
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
  })

  test('Projects nav item is visible in sidebar', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('link', { name: /^Projects$/i })).toBeVisible()
  })
})
