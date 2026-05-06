import { test, expect } from '../fixtures/auth.fixture'

test.describe('Navigation', () => {
  test('home page renders app shell after authentication', async ({ authenticatedPage: page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
  })

  test('sidebar shows Dashboard nav item', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible()
  })

  test('sidebar shows Waves nav item for Platform Migration Lead', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('link', { name: /waves/i })).toBeVisible()
  })

  test('sidebar logo links back to home', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await page.waitForSelector('[data-testid="app-shell"]')
    await page.getByRole('link', { name: /migration engine/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('clicking a project card navigates to project details', async ({ authenticatedPage: page }) => {
    // ProjectCard uses onClick + useNavigate (no <a> tags)
    // Click "View Details" on the first project card
    const viewDetailsBtn = page.locator('button').filter({ hasText: 'View Details' }).first()
    await expect(viewDetailsBtn).toBeVisible({ timeout: 10000 })
    await viewDetailsBtn.click()
    await expect(page).toHaveURL(/\/projects\//)
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
  })

  test('project details page shows breadcrumb', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await page.waitForSelector('[data-testid="app-shell"]')
    await expect(page.getByText('Home')).toBeVisible()
    await expect(page.getByText('PRJ-2024-ALPHA')).toBeVisible()
  })

  test('project details page shows all 9 section headings', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await page.waitForSelector('[data-testid="app-shell"]')

    const sections = [
      'Application Overview',
      'Risks & Blockers',
      'Current Infrastructure',
      'Data & Persistence',
      'Availability & Resilience',
      'Dependencies',
      'Non-Functional Requirements',
      'Migration Constraints',
      'Target Architecture',
    ]

    for (const heading of sections) {
      await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
    }
  })

  test('clicking Home breadcrumb navigates back to /', async ({ authenticatedPage: page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await page.waitForSelector('[data-testid="app-shell"]')
    await page.getByText('Home').click()
    await expect(page).toHaveURL('/')
  })
})
