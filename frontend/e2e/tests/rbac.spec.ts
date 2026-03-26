import { test, expect } from '../fixtures/auth.fixture'

/**
 * RBAC tests verify Platform Migration Lead positive access.
 * Negative role tests (other roles cannot access waves) are deferred —
 * the mock always returns Platform Migration Lead as the current user.
 */
test.describe('Role-Based Access Control', () => {
  test('Platform Migration Lead sees Waves nav item in sidebar', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('link', { name: /^Waves$/i })).toBeVisible()
  })

  test('Platform Migration Lead can access /waves page', async ({ authenticatedPage: page }) => {
    await page.goto('/waves')
    await page.waitForSelector('[data-testid="app-shell"]')
    // Scope heading to app-shell to avoid collision with SiteHeader title
    await expect(page.locator('[data-testid="app-shell"]').getByRole('heading', { name: /Wave Planning/i })).toBeVisible()
  })

  test('WavesPage shows Create Wave and Import Wave action buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/waves')
    await page.waitForSelector('[data-testid="app-shell"]')
    await expect(page.getByRole('button', { name: /Create Wave/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Import Wave/i })).toBeVisible()
  })

  test('Sign-off button is visible on an in-progress project', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await page.waitForSelector('[data-testid="app-shell"]')
    await expect(page.getByRole('button', { name: /sign-off/i })).toBeVisible()
  })

  test('sign-off modal opens and shows Step 1 of 2 for Platform Migration Lead', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await page.waitForSelector('[data-testid="app-shell"]')

    await page.getByRole('button', { name: /sign-off/i }).click()

    // Modal should appear with step indicator
    await expect(page.getByText('Step 1 of 2')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Authority Sign-off/i })).toBeVisible()
  })

  test('sign-off modal step 1 → step 2 flow for Platform Migration Lead', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await page.waitForSelector('[data-testid="app-shell"]')

    await page.getByRole('button', { name: /sign-off/i }).click()

    // Step 1: check the acknowledgement checkbox
    await page.locator('#ack').check()
    await expect(page.locator('#ack')).toBeChecked()

    // "Next: Configure Jira" button should be enabled now
    const nextBtn = page.getByRole('button', { name: /Next: Configure Jira/i })
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()

    // Step 2 should appear
    await expect(page.getByText('Step 2 of 2')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Configure Jira Sub-tasks/i })).toBeVisible()
    await expect(page.getByText('Sub-task Granularity')).toBeVisible()
  })
})
