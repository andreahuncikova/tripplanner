import { expect, test, type Page } from '@playwright/test'

// Only the parts that need no other website: the tests must not depend on Booking or Airbnb being up.
// Reading real pages is covered by the unit tests in server/tests/preview.test.ts.

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`

async function signUp(page: Page, name: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function preview(page: Page, url: string) {
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  return page.request.post('/api/preview', { data: { url }, headers: { Authorization: `Bearer ${token}` } })
}

test('link preview needs a log-in', async ({ request }) => {
  const res = await request.post('/api/preview', { data: { url: 'https://www.booking.com/hotel/x.html' } })
  expect(res.status()).toBe(401)
})

test('link preview refuses links into the server and its network', async ({ page }) => {
  await signUp(page, 'Mia')
  for (const url of ['http://localhost:3100/api/health', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'file:///etc/passwd', 'not a link']) {
    const res = await preview(page, url)
    expect(res.status(), url).toBe(400)
    expect((await res.json()).error, url).toBeTruthy()
  }
})
