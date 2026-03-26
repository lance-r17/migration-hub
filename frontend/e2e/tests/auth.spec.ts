import { test, expect } from '@playwright/test'
import { authenticate } from '../fixtures/auth.fixture'

test.describe('Authentication', () => {
  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated visit to /projects/:id redirects to /login', async ({ page }) => {
    await page.goto('/projects/PRJ-2024-ALPHA')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated visit to /waves redirects to /login', async ({ page }) => {
    await page.goto('/waves')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders SSO button and email/password form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /Login with Enterprise SSO/i })).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible()
  })

  test('clicking SSO button logs in and redirects to /', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /Login with Enterprise SSO/i }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
  })

  test('submitting email/password form logs in and redirects to /', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill('user@example.com')
    await page.locator('#password').fill('password123')
    await page.getByRole('button', { name: /^Login$/i }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible()
  })

  test('authenticated user can still view the login page', async ({ page }) => {
    // The app does not redirect away from /login for authenticated users;
    // the SSO button is still accessible.
    await authenticate(page)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('button', { name: /Login with Enterprise SSO/i })).toBeVisible()
  })

  test('logout clears session and redirects to /login', async ({ page }) => {
    await authenticate(page)
    await page.goto('/')
    await page.waitForSelector('[data-testid="app-shell"]')

    // Open the user menu (NavUser trigger button shows user name)
    await page.getByText('Henry Wilson').click()

    // Click Log out
    await page.getByRole('menuitem', { name: /log out/i }).click()

    await expect(page).toHaveURL(/\/login/)
  })
})
