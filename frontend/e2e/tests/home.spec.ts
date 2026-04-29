import { test, expect } from '../fixtures/auth.fixture'

test.describe('Home / Dashboard', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Wait for project cards to load (ProjectCard uses onClick/useNavigate, not <a> tags)
    await page.locator('button').filter({ hasText: /View Details|Resolve Issues/ }).first().waitFor({ timeout: 10000 })
  })

  test('page heading shows "Migration Workspace"', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Migration Workspace/i })).toBeVisible()
  })

  test('overall progress card shows "Overall Migration Progress"', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Overall Migration Progress')).toBeVisible()
    await expect(page.getByText('Total Assets')).toBeVisible()
    await expect(page.getByText('Migration Activity')).toBeVisible()
  })

  test('project status chart card shows stage overview', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Project Overview')).toBeVisible()
    await expect(page.getByRole('tab', { name: /Stages/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Surveys/i })).toBeVisible()
  })

  test('Active Projects section heading is visible', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Active Projects/i })).toBeVisible()
  })

  test('project cards are rendered with CTA buttons', async ({ authenticatedPage: page }) => {
    // ProjectCard renders "View Details" or "Resolve Issues" buttons
    const ctaButtons = page.locator('button').filter({ hasText: /View Details|Resolve Issues/ })
    await expect(ctaButtons.first()).toBeVisible()
    const count = await ctaButtons.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('activity timeline shows "Recent Activity" heading', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible()
  })

  test('"View All Projects" card is visible for Platform Migration Lead', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('View All Projects')).toBeVisible()
    await expect(page.getByText(/total projects/i)).toBeVisible()
  })

  test('clicking "View All Projects" navigates to /projects', async ({ authenticatedPage: page }) => {
    await page.getByText('View All Projects').click()
    await expect(page).toHaveURL('/projects')
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Projects/i })).toBeVisible()
  })
})
