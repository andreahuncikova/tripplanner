import { expect, test, type Browser, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`
const pad = (n: number) => String(n).padStart(2, '0')
// "YYYY-MM" some months from now, so the tests work on any day
const monthFromNow = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }

async function signUp(page: Page, name: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function call(page: Page, method: 'GET' | 'POST', path: string, data?: object) {
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` } })
}

// The organiser Mia and Theo, each in their own browser, both with the trip's Plan tab open
async function planWithTwo(browser: Browser, trip: object) {
  const mia = await (await browser.newContext()).newPage()
  const theo = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')
  await signUp(theo, 'Theo')
  const { inviteCode: code } = await (await call(mia, 'POST', '/api/groups', trip)).json()
  expect((await call(theo, 'POST', `/api/groups/${code}/join`)).ok()).toBe(true)
  await mia.goto(`/trips/${code}/plan`)
  await theo.goto(`/trips/${code}/plan`)
  return { mia, theo, code: code as string }
}

const summary = async (page: Page, code: string) => (await call(page, 'GET', `/api/groups/${code}/summary`)).json()
const datesHeading = (page: Page) => page.getByRole('heading', { name: "Mark the days you can't travel" })
// The step of the bar with the four planning steps that the group is in now
const currentStep = (page: Page) => page.getByRole('list', { name: 'Planning steps' }).locator('[aria-current="step"]')

test('the group suggests places and votes, and the organiser confirms the winner', async ({ browser }) => {
  const month = monthFromNow(2)
  const { mia, theo, code } = await planWithTwo(browser, { name: 'Summer', dates: { mode: 'find', fromMonth: month, toMonth: month } })
  await expect(mia.getByRole('heading', { name: 'Step 1: Where should we go?' })).toBeVisible()
  await expect(currentStep(mia)).toHaveText(/Destination/)

  await mia.getByLabel('Suggest a place').fill('Bali')
  await mia.getByRole('button', { name: 'Add' }).click()
  await theo.getByLabel('Suggest a place').fill('Lisbon')
  await theo.getByRole('button', { name: 'Add' }).click()
  // Each sees the other's suggestion without reloading
  await expect(mia.getByRole('button', { name: /^Lisbon/ })).toBeVisible()
  await expect(theo.getByRole('button', { name: /^Bali/ })).toBeVisible()

  // The same place twice would split the votes
  await theo.getByLabel('Suggest a place').fill('bali')
  await theo.getByRole('button', { name: 'Add' }).click()
  await expect(theo.getByRole('alert')).toContainText('already on the list')

  await theo.getByRole('button', { name: /^Bali/ }).click()
  await expect(theo.getByRole('button', { name: /^Bali/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(mia.getByText('1 of 2 voted · waiting for Mia')).toBeVisible()
  await mia.getByRole('button', { name: /^Bali/ }).click()
  // Under the list (on a computer the card at the top says it too)
  await expect(mia.getByText('2 of 2 voted').last()).toBeVisible()

  // Only the organiser confirms
  await expect(theo.getByRole('button', { name: /^Confirm/ })).toHaveCount(0)
  await mia.getByRole('button', { name: 'Confirm Bali as destination' }).click()
  await expect(datesHeading(mia)).toBeVisible()
  await expect(datesHeading(theo)).toBeVisible()
  await expect(currentStep(theo)).toHaveText(/Dates/)
  await expect(theo.getByRole('list', { name: 'Planning steps' })).toContainText('Destination ✓')
  expect(await summary(mia, code)).toMatchObject({ phase: 'calendar', approvedDest: 'Bali' })
})

test('everyone marks busy days, the organiser finds free windows and confirms the dates the group voted for', async ({ browser }) => {
  const month = monthFromNow(2)
  const { mia, theo, code } = await planWithTwo(browser, { name: 'Lisbon weekend', destination: 'Lisbon', dates: { mode: 'find', fromMonth: month, toMonth: month } })
  await expect(datesHeading(theo)).toBeVisible()

  // Theo cannot travel on the 10th; Mia's calendar shows it at once
  await theo.locator(`[data-day="${month}-10"]`).click()
  await expect(theo.locator(`[data-day="${month}-10"]`)).toHaveAttribute('aria-pressed', 'true')
  await expect(mia.locator(`[data-day="${month}-10"]`)).toHaveAttribute('aria-label', /Theo can't travel$/)

  await theo.getByRole('button', { name: "I'm done" }).click()
  await expect(mia.getByText('1 of 2 done')).toBeVisible()
  await expect(mia.getByText('Waiting for: Mia')).toBeVisible()

  // Only the organiser chooses the length and looks for the free windows
  await expect(theo.getByLabel('Trip length')).toHaveCount(0)
  await expect(theo.getByRole('button', { name: 'Find free dates' })).toHaveCount(0)
  await mia.getByLabel('Trip length').selectOption('5')
  await expect(theo.getByText('Trip length: 5 days')).toBeVisible()
  // Mia has not pressed "I'm done", so she is asked first: until she marks her days, she counts as free
  await mia.getByRole('button', { name: 'Find free dates' }).click()
  const ask = mia.getByRole('dialog', { name: 'Find free dates now?' })
  await expect(ask).toContainText("Mia hasn't pressed I'm done yet")
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await mia.getByRole('button', { name: "I'm done" }).click()
  await expect(theo.getByText('2 of 2 done')).toBeVisible()
  // Everyone is done: no question
  await mia.getByRole('button', { name: 'Find free dates' }).click()
  await expect(ask).toBeHidden()

  // Two windows: before and after the 10th. The card now asks for a vote
  await expect(theo.getByRole('button', { name: /^Vote for 1 – 9 / })).toBeVisible()
  await expect(theo.getByRole('heading', { name: 'Step 2: Vote for your dates' })).toBeVisible()
  await theo.getByRole('button', { name: /^Vote for 11 – / }).click()
  await expect(theo.getByRole('button', { name: /^Your vote 11 – / })).toBeVisible()

  await mia.getByRole('button', { name: /^Confirm 11 – / }).click()
  const dialog = mia.getByRole('dialog', { name: 'Confirm the trip dates?' })
  await dialog.getByLabel('Trip dates').selectOption(`${month}-12`)
  await dialog.getByRole('button', { name: 'Confirm dates' }).click()
  await expect(theo.getByRole('heading', { name: 'Step 3: Where will you stay?' })).toBeVisible()
  expect(await summary(mia, code)).toMatchObject({ phase: 'done', finalDate: `${month}-12`, tripDuration: 5 })

  // The steps collapse into one line, which opens the bar again
  const steps = theo.getByRole('button', { name: /^Next: Stays · Lisbon · 12–16 / })
  await expect(steps).toHaveAttribute('aria-expanded', 'false')
  await expect(theo.getByRole('list', { name: 'Planning steps' })).toHaveCount(0)
  await steps.click()
  await expect(currentStep(theo)).toHaveText(/Stays/)
  // The Itinerary tab shows the same line
  await theo.goto(`/trips/${code}/itinerary`)
  await expect(theo.getByRole('button', { name: /^Next: Stays/ })).toBeVisible()
  await theo.goto(`/trips/${code}/plan`)

  // The organiser can go back a step after a question; the group then votes again
  await expect(theo.getByRole('button', { name: 'Go back a step' })).toHaveCount(0)
  await mia.getByRole('button', { name: 'Go back a step' }).click()
  await mia.getByRole('dialog', { name: 'Back to voting on dates?' }).getByRole('button', { name: 'Go back' }).click()
  await expect(theo.getByRole('button', { name: /^Vote for 1 – 9 / })).toBeVisible()
  expect(await summary(mia, code)).toMatchObject({ phase: 'date_vote', finalDate: null })
})

test('a day in the past cannot be marked', async ({ browser }) => {
  const month = monthFromNow(0)
  const { mia } = await planWithTwo(browser, { name: 'This month', destination: 'Prague', dates: { mode: 'find', fromMonth: month, toMonth: month } })
  await expect(datesHeading(mia)).toBeVisible()
  const today = new Date().getDate()
  test.skip(today === 1, 'no past day this month')
  await expect(mia.locator(`[data-day="${month}-01"]`)).toBeDisabled()
})
