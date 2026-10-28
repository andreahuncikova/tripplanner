import { expect, test, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`

async function signUp(page: Page) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill('Noa')
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// Phones and desktop each have their own "Join with code" (a link and a button); only one may be visible at a time
const visibleJoin = (page: Page) => page.getByText('Join with code', { exact: true }).filter({ visible: true })

test('the empty dashboard shows one "Join with code"', async ({ page }) => {
  await signUp(page)
  await expect(page.getByRole('heading', { name: 'No trips yet' })).toBeVisible()
  await expect(visibleJoin(page)).toHaveCount(1)
})

test('the dashboard with a trip shows one "Join with code" and the trip card', async ({ page }) => {
  await signUp(page)
  // Create a trip through the API with the token the app saved after sign-up
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  const created = await page.request.post('/api/groups', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Lisbon weekend' },
  })
  expect(created.ok()).toBe(true)

  await page.reload()
  // The card in the page itself; on desktop the sidebar has a link with the same name too
  await expect(page.getByRole('main').getByRole('link', { name: /Lisbon weekend/ })).toBeVisible()
  await expect(visibleJoin(page)).toHaveCount(1)
})
