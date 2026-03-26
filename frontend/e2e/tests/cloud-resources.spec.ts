import { test, expect } from '../fixtures/auth.fixture'

const PROJECT_ID = 'PRJ-2024-ALPHA'

test.describe('Cloud Resources', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto(`/projects/${PROJECT_ID}`)
    await page.waitForSelector('[data-testid="app-shell"]')
  })

  test('Current Infrastructure section heading is visible', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('heading', { name: 'Current Infrastructure', level: 2 })).toBeVisible()
  })

  test('"Compute & Resources" card is rendered', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Compute & Resources')).toBeVisible()
  })

  test('resource table has column headers', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Resource Name')).toBeVisible()
    await expect(page.getByText('Category')).toBeVisible()
    // Scope the Sync header to the table header to avoid collisions with resource text
    await expect(page.getByRole('columnheader', { name: 'Sync' })).toBeVisible()
  })

  test('resource rows are rendered in the table', async ({ authenticatedPage: page }) => {
    // Wait for rows to load (mock async fetch)
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 10000 })
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('clicking a resource row opens the edit drawer', async ({ authenticatedPage: page }) => {
    // Click the first resource row to open the edit drawer
    const firstRow = page.locator('table tbody tr').first()
    await firstRow.click()

    // The CloudResourceEditDrawer opens as a Sheet (role="dialog")
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })

  test('edit drawer shows resource details', async ({ authenticatedPage: page }) => {
    await page.locator('table tbody tr').first().click()
    const drawer = page.locator('[role="dialog"]')
    await expect(drawer).toBeVisible()
    // The drawer header contains the resource name
    await expect(drawer.getByRole('heading')).toBeVisible()
  })

  test('edit drawer can be closed', async ({ authenticatedPage: page }) => {
    await page.locator('table tbody tr').first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Close via the Cancel button or Close button
    const dialog = page.locator('[role="dialog"]')
    const cancelBtn = dialog.getByRole('button', { name: /cancel/i })
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }

    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('"Change History" button opens the audit log drawer', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /change history/i }).click()
    // The AuditLogDrawer opens; it contains "Change History" or "Audit Log" heading
    await expect(page.locator('[role="dialog"]')).toBeVisible()
  })

  test('"RUN DISCOVERY SCAN" button is visible', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /run discovery scan/i })).toBeVisible()
  })
})
