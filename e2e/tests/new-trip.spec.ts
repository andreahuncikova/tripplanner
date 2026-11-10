import { expect, test, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`
const pad = (n: number) => String(n).padStart(2, '0')
// A day N days from today as "YYYY-MM-DD", so the tests work on any day
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const monthFromNow = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }

async function signUp(page: Page) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill('Ola')
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// The trip as its members get it from the server
async function summary(page: Page, code: string) {
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  const r = await page.request.get(`/api/groups/${code}/summary`, { headers: { Authorization: `Bearer ${token}` } })
  return r.json()
}

async function createdCode(page: Page) {
  await expect(page).toHaveURL(/\/trips\/[A-Z0-9]{8}/)
  return page.url().match(/\/trips\/([A-Z0-9]{8})/)![1]
}

test('destination and dates known: the trip is ready to go right away', async ({ page }) => {
  await signUp(page)
  await page.goto('/new-trip')
  await page.getByLabel('Trip name').fill('Bali with friends')
  await page.getByLabel('Destination').fill('Bali')
  await page.getByLabel('From', { exact: true }).fill(inDays(30))
  await page.getByLabel('To', { exact: true }).fill(inDays(39))
  await page.getByLabel('Group currency').selectOption('DKK')
  await page.getByRole('button', { name: 'Create trip and invite friends' }).click()

  const code = await createdCode(page)
  const trip = await summary(page, code)
  expect(trip).toMatchObject({ phase: 'done', approvedDest: 'Bali', currency: 'DKK', tripDuration: 10, finalDate: inDays(30) })
  expect(trip.finalDateLabel).toMatch(/\(10 days\)$/)

  await page.goto('/dashboard')
  await expect(page.getByRole('main').getByRole('link', { name: /Bali with friends/ })).toContainText('Ready to go')
})

test('destination known, dates not: the group starts by marking free days', async ({ page }) => {
  await signUp(page)
  await page.goto('/new-trip')
  await page.getByLabel('Trip name').fill('Lisbon weekend')
  await page.getByLabel('Destination').fill('Lisbon')
  await page.getByLabel('Help us find dates').check()
  await page.getByLabel('From', { exact: true }).selectOption(monthFromNow(2))
  await page.getByLabel('To', { exact: true }).selectOption(monthFromNow(3))
  await page.getByRole('button', { name: 'Create trip and invite friends' }).click()

  const trip = await summary(page, await createdCode(page))
  expect(trip).toMatchObject({ phase: 'calendar', approvedDest: 'Lisbon', currency: 'EUR', finalDate: null })
  expect(trip.tripWindowStart).toBe(`${monthFromNow(2)}-01`)
  expect(trip.tripWindowEnd.slice(0, 7)).toBe(monthFromNow(3))
})

test('nothing known yet: the group starts with the destination poll', async ({ page }) => {
  await signUp(page)
  await page.goto('/new-trip')
  await page.getByLabel('Trip name').fill('Summer trip')
  await page.getByLabel('Help us find dates').check()
  await page.getByRole('button', { name: 'Create trip and invite friends' }).click()

  const trip = await summary(page, await createdCode(page))
  expect(trip).toMatchObject({ phase: 'destinations', approvedDest: null })

  await page.goto('/dashboard')
  await expect(page.getByRole('main').getByRole('link', { name: /Summer trip/ })).toContainText('Choosing destination')
})

test('"We know our dates" needs both days before the trip is created', async ({ page }) => {
  await signUp(page)
  await page.goto('/new-trip')
  await page.getByLabel('Trip name').fill('No dates yet')
  await page.getByRole('button', { name: 'Create trip and invite friends' }).click()
  // The browser stops the form, so no trip is created
  await expect(page).toHaveURL(/\/new-trip$/)
})

test('the last month cannot be before the first one', async ({ page }) => {
  await signUp(page)
  await page.goto('/new-trip')
  await page.getByLabel('Help us find dates').check()
  await page.getByLabel('From', { exact: true }).selectOption(monthFromNow(5))
  const toMonths = await page.getByLabel('To', { exact: true }).locator('option').evaluateAll(o => o.map(x => (x as HTMLOptionElement).value))
  expect(toMonths[0]).toBe(monthFromNow(5))
  expect(toMonths.length).toBeLessThanOrEqual(12)
})
