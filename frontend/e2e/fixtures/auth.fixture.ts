import { test as base, type Page } from '@playwright/test'

/**
 * Injects auth state into sessionStorage before any page load, simulating
 * the UserContext `AUTH_KEY = 'auth'` flag set on login.
 */
async function injectAuth(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('auth', 'true')
  })
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await injectAuth(page)
    await page.goto('/')
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10000 })
    await use(page)
  },
})

export { expect } from '@playwright/test'

/** Helper to authenticate any page without navigating first. */
export async function authenticate(page: Page) {
  await injectAuth(page)
}
