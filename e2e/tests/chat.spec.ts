import { expect, test, type Browser, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`

async function signUp(page: Page, name: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

// The API with the token the app saved after sign-up
async function call(page: Page, method: 'POST', path: string, data?: object) {
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` } })
}

// The organiser Mia with a trip, and Theo, who joined it, each in their own browser
async function tripWithTwo(browser: Browser) {
  const mia = await (await browser.newContext()).newPage()
  const theo = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')
  await signUp(theo, 'Theo')
  const { inviteCode: code } = await (await call(mia, 'POST', '/api/groups', { name: 'Bali with friends' })).json()
  expect((await call(theo, 'POST', `/api/groups/${code}/join`)).ok()).toBe(true)
  return { mia, theo, code: code as string }
}

const messages = (page: Page) => page.getByRole('list', { name: 'Messages' })

test('a message reaches the other member right away and is still there after a reload', async ({ browser }) => {
  const { mia, theo, code } = await tripWithTwo(browser)
  await mia.goto(`/trips/${code}/chat`)
  await theo.goto(`/trips/${code}/chat`)

  // System messages are saved too: the trip was created, then Theo joined, in that order
  await expect(messages(mia).getByText('Theo joined the trip.')).toBeVisible()
  await expect(messages(mia).getByRole('listitem').first()).toContainText('Trip "Bali with friends" created!')

  await mia.getByLabel('Message', { exact: true }).fill('See you in Bali!')
  await mia.getByRole('button', { name: 'Send' }).click()
  await expect(messages(mia).getByText('See you in Bali!')).toBeVisible()
  // Theo did not reload
  await expect(messages(theo).getByText('See you in Bali!')).toBeVisible()

  // After a reload the messages come from the database, oldest first
  await theo.reload()
  await expect(messages(theo).getByRole('listitem').last()).toContainText('See you in Bali!')
  await expect(messages(theo).getByText('Theo joined the trip.')).toBeVisible()
})

test('a long word or link without spaces wraps inside its bubble', async ({ browser }) => {
  const { mia, code } = await tripWithTwo(browser)
  await mia.goto(`/trips/${code}/chat`)
  const long = 'd'.repeat(120)
  await mia.getByLabel('Message', { exact: true }).fill(long)
  await mia.getByRole('button', { name: 'Send' }).click()

  const bubble = messages(mia).getByText(long)
  await expect(bubble).toBeVisible()
  const list = (await messages(mia).boundingBox())!
  const box = (await bubble.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(list.x)
  expect(box.x + box.width).toBeLessThanOrEqual(list.x + list.width)
})

test('a link in a message can be clicked and is readable on your own blue bubble', async ({ browser }) => {
  const { mia, code } = await tripWithTwo(browser)
  await mia.goto(`/trips/${code}/chat`)
  await mia.getByLabel('Message', { exact: true }).fill('Look at this one https://stay.invalid/rooms/1?check_in=2026-11-13')
  await mia.getByRole('button', { name: 'Send' }).click()

  const link = messages(mia).getByRole('link', { name: 'https://stay.invalid/rooms/1?check_in=2026-11-13' })
  await expect(link).toHaveAttribute('href', 'https://stay.invalid/rooms/1?check_in=2026-11-13')
  await expect(link).toHaveAttribute('target', '_blank')
  // The link takes the bubble's white text, not the blue link colour of the page
  const [color, background] = await link.evaluate(a => [getComputedStyle(a).color, getComputedStyle(a.closest('p')!).backgroundColor])
  expect(color).not.toBe(background)
})
