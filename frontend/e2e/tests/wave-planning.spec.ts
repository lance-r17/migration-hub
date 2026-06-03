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
    await expect(page.getByRole('dialog', { name: 'Create Wave' })).not.toBeVisible({ timeout: 10000 })

    // Wait for the new wave to appear in the table (allow time for refetch after mock delay)
    // Use first() in case a previous test run left the wave in the mock store.
    await expect(page.locator('table tbody').getByText('E2E Test Wave', { exact: true }).first()).toBeVisible({ timeout: 10000 })
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

test.describe('Category Milestones', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/waves')
    await page.waitForSelector('[data-testid="app-shell"]')
  })

  test('category milestones section is visible', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="category-milestones-section"]')).toBeVisible()
    await expect(page.locator('[data-testid="category-milestones-table"]')).toBeVisible()
  })

  async function pickCalendarRange(page: any, drawer: any, startDay: string, endDay: string) {
    await drawer.getByTestId('category-milestone-date-range').click()
    const calendar = page.locator('[data-radix-popper-content-wrapper]')
    await calendar.waitFor({ timeout: 5000 })
    await calendar.locator('button[data-day]').filter({ hasText: new RegExp(`^${startDay}$`) }).first().click()
    await expect(calendar.locator('[data-range-start="true"]')).toBeVisible({ timeout: 3000 })
    const endBtn = calendar.locator('button[data-day]').filter({ hasText: new RegExp(`^${endDay}$`) }).first()
    await endBtn.evaluate((el: HTMLButtonElement) => el.click())
  }

  test('can create a category milestone', async ({ authenticatedPage: page }) => {
    await page.getByTestId('create-category-milestone-btn').click()
    const drawer = page.locator('[data-testid="category-milestone-drawer"]')
    await expect(drawer).toBeVisible()

    await drawer.getByTestId('category-milestone-name-input').fill('E2E Test CM')
    await pickCalendarRange(page, drawer, '10', '20')

    await drawer.getByTestId('category-milestone-save-btn').click()

    await expect(drawer).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="category-milestones-table"]').getByText('E2E Test CM')).toBeVisible({ timeout: 10000 })
  })

  test('can open assign drawer for a category milestone', async ({ authenticatedPage: page }) => {
    const assignBtn = page.locator('[data-testid="assign-category-milestone-btn"]').first()
    await expect(assignBtn).toBeVisible()
    await assignBtn.click()

    const drawer = page.locator('[data-testid="assign-category-milestone-drawer"]')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText(/Assign or unassign projects from/i)).toBeVisible()

    await drawer.getByTestId('assign-cm-cancel').click()
    await expect(drawer).not.toBeVisible()
  })

  test('can assign a project to a category milestone', async ({ authenticatedPage: page }) => {
    // Ensure a category milestone exists
    await page.getByTestId('create-category-milestone-btn').click()
    const cmDrawer = page.locator('[data-testid="category-milestone-drawer"]')
    await cmDrawer.getByTestId('category-milestone-name-input').fill('Assign Test CM')
    await pickCalendarRange(page, cmDrawer, '10', '20')
    await cmDrawer.getByTestId('category-milestone-save-btn').click()
    await expect(cmDrawer).not.toBeVisible({ timeout: 10000 })

    // Open assign drawer
    const row = page.locator('[data-testid="category-milestone-row"]').filter({ hasText: 'Assign Test CM' })
    await row.locator('[data-testid="assign-category-milestone-btn"]').click()

    const drawer = page.locator('[data-testid="assign-category-milestone-drawer"]')
    await expect(drawer).toBeVisible()

    // Select first project
    const firstProject = drawer.locator('div.cursor-pointer').first()
    await firstProject.click()

    await drawer.getByTestId('assign-cm-assign').click()

    await expect(drawer).not.toBeVisible({ timeout: 10000 })
  })

  test('can delete a category milestone', async ({ authenticatedPage: page }) => {
    // Create a milestone to delete
    await page.getByTestId('create-category-milestone-btn').click()
    const cmDrawer = page.locator('[data-testid="category-milestone-drawer"]')
    await cmDrawer.getByTestId('category-milestone-name-input').fill('Delete Test CM')
    await pickCalendarRange(page, cmDrawer, '10', '20')
    await cmDrawer.getByTestId('category-milestone-save-btn').click()
    await expect(cmDrawer).not.toBeVisible({ timeout: 10000 })

    // Delete it
    const row = page.locator('[data-testid="category-milestone-row"]').filter({ hasText: 'Delete Test CM' })
    await row.locator('[data-testid="delete-category-milestone-btn"]').click()

    // Wait for deletion (mock delay)
    await expect(page.locator('[data-testid="category-milestones-table"]').getByText('Delete Test CM')).not.toBeVisible({ timeout: 10000 })
  })
})

test.describe('Gantt Chart Category Milestone Filter', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/waves/gantt')
    await page.waitForSelector('[data-testid="app-shell"]')
  })

  test('category milestone filter button is visible', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="category-milestone-filter-btn"]')).toBeVisible()
  })

  test('can open category milestone filter dropdown', async ({ authenticatedPage: page }) => {
    await page.locator('[data-testid="category-milestone-filter-btn"]').click()
    await expect(page.locator('[data-radix-popper-content-wrapper]')).toBeVisible()
  })
})
