import { expect, test, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`

async function signUp(page: Page) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill('Ida')
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// Chrome fires "beforeinstallprompt" by itself only when the app is served over HTTPS with a service worker.
// The test sends the same event, with a fake prompt() that remembers it was called.
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    event.prompt = async () => { (window as unknown as { prompted: boolean }).prompted = true }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
}

const banner = (page: Page) => page.getByRole('region', { name: 'Install the app' })

test.describe('install banner (Android and desktop Chrome)', () => {
  test('shows nothing when the browser does not offer installation', async ({ page }) => {
    await signUp(page)
    await expect(banner(page)).toHaveCount(0)
  })

  test('opens the browser\'s install dialog and hides after installing', async ({ page }) => {
    await signUp(page)
    await offerInstall(page)
    await expect(banner(page)).toBeVisible()

    await banner(page).getByRole('button', { name: 'Install' }).click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true)
    await expect(banner(page)).toHaveCount(0)
  })

  test('"Not now" hides the banner, also after a reload', async ({ page }) => {
    await signUp(page)
    await offerInstall(page)
    await banner(page).getByRole('button', { name: 'Not now' }).click()
    await expect(banner(page)).toHaveCount(0)

    await page.reload()
    await offerInstall(page)
    await expect(banner(page)).toHaveCount(0)
  })
})

test.describe('install banner (iPhone)', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  })

  test('explains Share → Add to Home Screen, because Safari has no install event', async ({ page }) => {
    await signUp(page)
    await expect(banner(page)).toContainText('Add to Home Screen')
    await banner(page).getByRole('button', { name: 'Got it' }).click()
    await expect(banner(page)).toHaveCount(0)
  })
})
