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
    await expect(page.getByRole('columnheader', { name: 'Infra Footprint' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Migration Driver' })).toBeVisible()
  })

  test('infra footprint tooltip shows score matrix and raw values', async ({ authenticatedPage: page }) => {
    const firstRow = page.locator('table tbody tr').first()
    const cell = firstRow.getByRole('cell', { name: /Lightweight|Mid-tier|Large|Extended/ }).first()
    await cell.hover()
    const tooltip = page.locator('role=tooltip')
    await expect(tooltip.getByText('Infra Footprint:')).toBeVisible()
    await expect(tooltip.getByText('No. of ECS')).toBeVisible()
    await expect(tooltip.getByText('Data Volume (DB / OSS)')).toBeVisible()
    await expect(tooltip.getByText('No. of MaxCompute')).toBeVisible()
    await expect(tooltip.getByText(/Raw values:/)).toBeVisible()
  })

  test('migration driver tooltip shows score matrix and raw values', async ({ authenticatedPage: page }) => {
    const firstRow = page.locator('table tbody tr').first()
    const cell = firstRow.getByRole('cell', { name: /Low|Medium|High/ }).first()
    await cell.hover()
    const tooltip = page.locator('role=tooltip')
    await expect(tooltip.getByText('Migration Driver:')).toBeVisible()
    await expect(tooltip.getByText('App Tier / IITA')).toBeVisible()
    await expect(tooltip.getByText('Third-party Effort')).toBeVisible()
    await expect(tooltip.getByText('Dependency')).toBeVisible()
    await expect(tooltip.getByText('External Users')).toBeVisible()
    await expect(tooltip.getByText('Internal Users')).toBeVisible()
    await expect(tooltip.getByText('No. of Apps')).toBeVisible()
    await expect(tooltip.getByText(/Raw values:/)).toBeVisible()
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
