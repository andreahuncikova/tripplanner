import { expect, test, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`
// The smallest PNG there is: one pixel
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function signUp(page: Page, name: string, email = newEmail()) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  return email
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

const call = async (page: Page, method: 'GET' | 'POST', path: string, data?: object) => {
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` } })
}

test('a new name and photo show in the profile and in the trips', async ({ page }) => {
  await signUp(page, 'Mia')
  const { inviteCode } = await (await call(page, 'POST', '/api/groups', { name: 'Lisbon' })).json()
  await page.goto('/profile')

  await page.getByRole('button', { name: 'Change the name (Mia)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Your name' })
  await dialog.getByLabel('Your name').fill('Mia K')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Change the name (Mia K)' })).toBeVisible()

  // The trip keeps a copy of each member's name; it changes too
  await page.goto(`/trips/${inviteCode}/settings`)
  await expect(page.getByRole('region', { name: /^Members/ })).toContainText('Mia K (you)')

  await page.goto('/profile')
  await page.getByLabel('Choose a profile photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('region', { name: 'You' }).getByRole('img', { name: 'Mia K' })).toHaveAttribute('src', /\/api\/files\/[a-f0-9]{48}$/)
  const summary = await (await call(page, 'GET', `/api/groups/${inviteCode}/summary`)).json()
  expect(summary.members[0].photo).toMatch(/^\/api\/files\/[a-f0-9]{48}$/)

  await page.getByRole('button', { name: 'Remove photo' }).click()
  await expect(page.getByRole('button', { name: 'Add a photo' })).toBeVisible()
})

test('a new e-mail only counts after the link in the e-mail is opened', async ({ page }) => {
  const oldEmail = await signUp(page, 'Theo')
  const email = newEmail()
  await page.goto('/profile')

  await page.getByRole('button', { name: /^Change the e-mail/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Change your e-mail' })
  await dialog.getByLabel('New e-mail').fill(email)
  await dialog.getByLabel('Your password').fill('wrong-password')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Your password is not correct')

  await dialog.getByLabel('Your password').fill('password1')
  // The tests cannot read e-mails: their server also puts the link in the answer (EMAIL_DEV_LINKS)
  const answer = page.waitForResponse(r => r.url().endsWith('/api/auth/email') && r.request().method() === 'POST')
  await dialog.getByRole('button', { name: 'Save' }).click()
  const { devLink } = await (await answer).json()
  await expect(page.getByRole('status').filter({ hasText: 'We sent a link to' })).toContainText(email)

  // Not confirmed yet: the old e-mail still logs in, the new one not
  await page.getByRole('button', { name: 'Log out' }).click()
  await logIn(page, email, 'password1')
  await expect(page.getByRole('alert')).toBeVisible()

  await page.goto(new URL(devLink).pathname + new URL(devLink).search)
  await expect(page.getByRole('heading', { name: 'E-mail changed' })).toBeVisible()
  // The link works only once
  await page.reload()
  await expect(page.getByRole('heading', { name: 'The link did not work' })).toBeVisible()

  await logIn(page, oldEmail, 'password1')
  await expect(page.getByRole('alert')).toBeVisible()
  await logIn(page, email, 'password1')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('the password can be changed in the profile', async ({ page }) => {
  const email = await signUp(page, 'Sara')
  await page.goto('/profile')
  await page.getByRole('button', { name: /^Change the password/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Change your password' })
  await dialog.getByLabel('Current password').fill('password1')
  await dialog.getByLabel('New password').fill('password2')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  // This device stays logged in
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  await page.getByRole('button', { name: 'Log out' }).click()
  await logIn(page, email, 'password2')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('a PayPal.Me link is saved in the profile and the trips know it', async ({ page }) => {
  await signUp(page, 'Leo')
  const { inviteCode } = await (await call(page, 'POST', '/api/groups', { name: 'Porto' })).json()
  await page.goto('/profile')
  const payments = page.getByRole('region', { name: 'Payment methods' })
  await expect(payments).toContainText('Not added')

  await payments.getByRole('button', { name: /^Change the paypal\.me/ }).click()
  const dialog = page.getByRole('dialog', { name: 'PayPal.Me' })
  await dialog.getByLabel('Your PayPal.Me link').fill('not a link')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Please paste your PayPal.Me link')
  // A whole link from the PayPal app works, also with an amount at the end
  await dialog.getByLabel('Your PayPal.Me link').fill('https://www.paypal.me/LeoTravels/25')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(payments).toContainText('paypal.me/LeoTravels')
  await expect(payments.getByRole('link', { name: 'Check that it works' })).toHaveAttribute('href', 'https://paypal.me/LeoTravels')

  // The trip's copy of the member has it too, for the Pay button
  const summary = await (await call(page, 'GET', `/api/groups/${inviteCode}/summary`)).json()
  expect(summary.members[0].paypalMe).toBe('LeoTravels')

  await payments.getByRole('button', { name: /^Change the paypal\.me/ }).click()
  await page.getByRole('dialog', { name: 'PayPal.Me' }).getByRole('button', { name: 'Remove the link' }).click()
  await expect(payments).toContainText('Not added')
})
