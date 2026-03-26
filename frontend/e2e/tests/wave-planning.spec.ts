import { test, expect } from '../fixtures/auth.fixture'

test.describe('Wave Planning', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/waves')
    await page.waitForSelector('[data-testid="app-shell"]')
  })

  test('waves page renders "Wave Planning" heading', async ({ authenticatedPage: page }) => {
    // Scope heading to app-shell to avoid collision with SiteHeader title
    await expect(page.locator('[data-testid="app-shell"]').getByRole('heading', { name: /Wave Planning/i })).toBeVisible()
  })

  test('waves table renders with column headers', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('columnheader', { name: 'Wave' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Jira Epic' })).toBeVisible()
  })

  test('mock waves are shown in the table', async ({ authenticatedPage: page }) => {
    // The mock data has at least one wave
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('"Create Wave" button opens the create drawer', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /Create Wave/i }).click()
    const drawer = page.locator('[role="dialog"]')
    await expect(drawer).toBeVisible()
    // Use heading role to avoid collision with submit button text
    await expect(drawer.getByRole('heading', { name: 'Create Wave' })).toBeVisible()
  })

  test('"Import Wave" button opens the import drawer', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /Import Wave/i }).click()
    const drawer = page.locator('[role="dialog"]')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Import Wave from Jira')).toBeVisible()
  })

  test('create wave drawer has wave name input', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /Create Wave/i }).click()
    const drawer = page.locator('[role="dialog"]')
    await expect(drawer.getByPlaceholder('Wave 5 – Q1 2027')).toBeVisible()
  })

  test('create wave drawer shows validation error when required fields are empty', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /Create Wave/i }).click()
    const drawer = page.locator('[role="dialog"]')
    // Click the submit button without filling required fields
    await drawer.getByRole('button', { name: /^Create Wave$/i }).click()
    await expect(page.getByText(/fill in all required fields/i)).toBeVisible()
  })

  test('can create a new wave end-to-end', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /Create Wave/i }).click()
    const drawer = page.locator('[role="dialog"]')

    // Fill wave name
    await drawer.getByPlaceholder('Wave 5 – Q1 2027').fill('E2E Test Wave')

    // Open date picker and select a range
    await page.locator('[role="dialog"]').locator('button').filter({ hasText: 'Pick a date range' }).click()
    const calendar = page.locator('[data-radix-popper-content-wrapper]')
    await calendar.waitFor({ timeout: 5000 })

    // react-day-picker v9: day buttons have data-day attribute with the full date string.
    // Use button[data-day] + text filter to click specific days.
    // Click day 10 as range start, day 20 as range end.
    await calendar.locator('button[data-day]').filter({ hasText: /^10$/ }).first().click()

    // Wait for the calendar to process the range-start selection before clicking the end date.
    // (react-day-picker re-renders after first selection, causing DOM detachment if clicked too quickly)
    await expect(calendar.locator('[data-range-start="true"]')).toBeVisible({ timeout: 3000 })

    // Use evaluate() to dispatch click via JS, bypassing Playwright's mouse-move events
    // that trigger hover-based calendar re-renders causing DOM detachment.
    const day20 = calendar.locator('button[data-day]').filter({ hasText: /^20$/ }).first()
    await day20.evaluate((el: HTMLButtonElement) => el.click())

    // Submit the form — scope to dialog to avoid the page header button
    await page.locator('[role="dialog"]').getByRole('button', { name: /^Create Wave$/i }).click()

    // Wait for the drawer to close after successful creation
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 })

    // Wait for the new wave to appear in the table (allow time for refetch after mock delay)
    // Use exact match to avoid collision with the toast notification
    // (toast also contains "E2E Test Wave" as part of a longer string)
    await expect(page.getByText('E2E Test Wave', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('can import a wave via Jira epic key', async ({ authenticatedPage: page }) => {
    const rowsBefore = await page.locator('table tbody tr').count()

    await page.getByRole('button', { name: /Import Wave/i }).click()
    const drawer = page.locator('[role="dialog"]')

    // Fill in the epic key (must match format [A-Z]+-\d+)
    await drawer.getByPlaceholder('MIG-42').fill('MIG-99')

    // Submit
    await page.locator('[role="dialog"]').getByRole('button', { name: /^Import Wave$/i }).click()

    // Wait for drawer to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 })

    // Verify imported wave appears
    const rowsAfter = await page.locator('table tbody tr').count()
    expect(rowsAfter).toBeGreaterThan(rowsBefore)
  })
})
