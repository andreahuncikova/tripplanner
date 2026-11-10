import { expect, test, type Browser, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`
const pad = (n: number) => String(n).padStart(2, '0')
// A day N days from today as "YYYY-MM-DD", so the tests work on any day
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

async function signUp(page: Page, name: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// The API with the token the app saved after sign-up
async function call(page: Page, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, data?: object) {
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` } })
}

// The organiser Mia with a trip, and Theo, who joined it, each in their own browser
async function tripWithTwo(browser: Browser, trip: object = { name: 'Bali with friends' }) {
  const mia = await (await browser.newContext()).newPage()
  const theo = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')
  await signUp(theo, 'Theo')
  const { inviteCode: code } = await (await call(mia, 'POST', '/api/groups', trip)).json()
  expect((await call(theo, 'POST', `/api/groups/${code}/join`)).ok()).toBe(true)
  return { mia, theo, code: code as string }
}

const tripName = (page: Page) => page.getByRole('heading', { level: 1 })

test('a new trip opens with "Invite friends": the code and a link that can be copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await signUp(page, 'Mia')
  await page.goto('/new-trip')
  await page.getByLabel('Trip name').fill('Lisbon weekend')
  await page.getByLabel('Help us find dates').check()
  await page.getByRole('button', { name: 'Create trip and invite friends' }).click()

  const invite = page.getByRole('dialog', { name: 'Invite friends' })
  await expect(invite).toBeVisible()
  const code = page.url().match(/\/trips\/([A-Z0-9]{8})/)![1]
  await expect(invite).toContainText(code)
  await expect(invite.getByLabel('Invite link')).toHaveValue(new RegExp(`/join\\?code=${code}$`))

  await invite.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByText('Link copied')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/join\\?code=${code}$`))

  // The Invite button in the trip header opens it again
  await invite.getByRole('button', { name: 'Close' }).click()
  await expect(invite).toBeHidden()
  await page.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect(invite).toBeVisible()
})

test('the organiser renames the trip and the other member sees the new name right away', async ({ browser }) => {
  const { mia, theo, code } = await tripWithTwo(browser)
  await theo.goto(`/trips/${code}/plan`)
  await expect(tripName(theo)).toHaveText('Bali with friends')

  await mia.goto(`/trips/${code}`)
  await mia.getByRole('link', { name: 'Trip settings' }).click()
  await expect(mia).toHaveURL(new RegExp(`/trips/${code}/settings$`))
  await expect(mia.getByRole('region', { name: 'Members · 2' })).toContainText('Mia (you)')
  await expect(mia.getByRole('region', { name: 'Members · 2' })).toContainText('Organiser')

  await mia.getByRole('button', { name: /^Change the name/ }).click()
  const dialog = mia.getByRole('dialog', { name: 'Trip name' })
  await dialog.getByLabel('Trip name').fill('Bali 2027')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(mia.getByRole('button', { name: /^Change the name \(Bali 2027\)/ })).toBeVisible()

  // Theo still has the trip open and did not reload
  await expect(tripName(theo)).toHaveText('Bali 2027')
})

test('a member sees the settings but cannot change or delete the trip', async ({ browser }) => {
  const { theo, code } = await tripWithTwo(browser)
  await theo.goto(`/trips/${code}/settings`)
  await expect(theo.getByRole('region', { name: 'Trip' })).toContainText('Bali with friends')
  await expect(theo.getByRole('button', { name: /^Change the/ })).toHaveCount(0)
  await expect(theo.getByRole('button', { name: /Delete trip/ })).toHaveCount(0)
  await expect(theo.getByText('Only the organiser can delete the trip.').filter({ visible: true })).toBeVisible()

  // The server says no as well, even without the screen
  expect((await call(theo, 'PATCH', `/api/groups/${code}`, { name: 'Mine now' })).status()).toBe(403)
  expect((await call(theo, 'DELETE', `/api/groups/${code}`)).status()).toBe(403)
})

test('a member leaves: the trip is gone from their trips and the organiser sees one member fewer', async ({ browser }) => {
  const { mia, theo, code } = await tripWithTwo(browser)
  await mia.goto(`/trips/${code}/settings`)
  await expect(mia.getByRole('region', { name: 'Members · 2' })).toBeVisible()

  await theo.goto(`/trips/${code}/settings`)
  await theo.getByRole('button', { name: 'Leave trip' }).click()
  const confirm = theo.getByRole('dialog', { name: 'Leave Bali with friends?' })
  await expect(confirm).toContainText('expenses you added stay')
  await confirm.getByRole('button', { name: 'Leave trip' }).click()
  await expect(theo).toHaveURL(/\/dashboard$/)
  await expect(theo.getByRole('main').getByRole('link', { name: /Bali with friends/ })).toHaveCount(0)

  // Mia's screen updates by itself, and the trip is closed for Theo
  await expect(mia.getByRole('region', { name: 'Members · 1' })).toBeVisible()
  expect((await call(theo, 'GET', `/api/groups/${code}/summary`)).status()).toBe(404)
})

test('the organiser deletes the trip: a member who has it open is sent back to their trips', async ({ browser }) => {
  const { mia, theo, code } = await tripWithTwo(browser)
  await theo.goto(`/trips/${code}/plan`)
  await expect(tripName(theo)).toHaveText('Bali with friends')

  await mia.goto(`/trips/${code}/settings`)
  await mia.getByRole('button', { name: /Delete trip/ }).click()
  const confirm = mia.getByRole('dialog', { name: 'Delete the trip for everyone?' })
  await expect(confirm).toContainText('2 people')
  await confirm.getByRole('button', { name: 'Delete trip' }).click()
  await expect(mia).toHaveURL(/\/dashboard$/)
  await expect(mia.getByText('Trip deleted')).toBeVisible()

  await expect(theo).toHaveURL(/\/dashboard$/)
  await expect(theo.getByText('The organiser deleted this trip')).toBeVisible()
})

test('known dates can be changed; dates the group chooses cannot', async ({ browser }) => {
  const { mia, code } = await tripWithTwo(browser, {
    name: 'Ski trip', destination: 'Alps', dates: { mode: 'known', start: inDays(30), end: inDays(36) },
  })
  await mia.goto(`/trips/${code}/settings`)
  await expect(mia.getByRole('button', { name: /^Change the dates .*\(7 days\)/ })).toBeVisible()

  await mia.getByRole('button', { name: /^Change the dates/ }).click()
  const dialog = mia.getByRole('dialog', { name: 'Trip dates' })
  await dialog.getByLabel('To', { exact: true }).fill(inDays(39))
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(mia.getByRole('button', { name: /^Change the dates .*\(10 days\)/ })).toBeVisible()

  // A trip that finds its dates with the group has no Edit for the dates
  const { inviteCode } = await (await call(mia, 'POST', '/api/groups', { name: 'Summer', dates: { mode: 'find', fromMonth: inDays(40).slice(0, 7), toMonth: inDays(70).slice(0, 7) } })).json()
  await mia.goto(`/trips/${inviteCode}/settings`)
  await expect(mia.getByRole('button', { name: /^Change the dates/ })).toHaveCount(0)
  expect((await call(mia, 'PATCH', `/api/groups/${inviteCode}`, { dates: { start: inDays(50), end: inDays(55) } })).status()).toBe(400)
})
