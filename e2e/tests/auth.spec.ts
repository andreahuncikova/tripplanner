import { expect, test, type Page } from '@playwright/test'

// A new email for every test, so tests never depend on each other
const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`

async function signUp(page: Page, name: string, email: string, password: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
}

test('a new user can sign up and lands on an empty dashboard', async ({ page }) => {
  await signUp(page, 'Mia Novak', newEmail(), 'password1')

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Your trips' })).toBeVisible()
  await expect(page.getByText('Hi, Mia')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No trips yet' })).toBeVisible()
})

test('a user can log out and log in again', async ({ page }) => {
  const email = newEmail()
  await signUp(page, 'Ben', email, 'password1')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: 'Log out' }).click()
  // After log-out the dashboard is not reachable any more
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText('Hi, Ben')).toBeVisible()
})

test('a wrong password shows an error and keeps the user on the log-in page', async ({ page }) => {
  const email = newEmail()
  await signUp(page, 'Eva', email, 'password1')
  await page.getByRole('button', { name: 'Log out' }).click()

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()

  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password')
  await expect(page).toHaveURL(/\/login/)
})

test('sign-up needs a password of at least 8 characters', async ({ page }) => {
  await page.goto('/login?mode=signup')
  const password = page.getByLabel('Password')
  const hint = page.getByText(/At least 8 characters/)

  await password.fill('1234567')
  await expect(hint).toHaveText('At least 8 characters')

  await page.getByLabel('Your name').fill('Tom')
  await page.getByLabel('Email').fill(newEmail())
  await page.getByRole('button', { name: 'Create account' }).click()
  // The browser stops the form, so the user stays on the sign-up page
  await expect(page).toHaveURL(/\/login\?mode=signup/)

  await password.fill('12345678')
  await expect(hint).toHaveText('✓ At least 8 characters')
})

test('a page that needs log-in sends a visitor to the log-in page and back', async ({ page }) => {
  await page.goto('/join?code=A3BF92C1')
  await expect(page).toHaveURL(/\/login/)

  // After signing up the visitor comes back to the page they wanted, with the code still there
  await page.getByRole('tab', { name: 'Sign up' }).click()
  await page.getByLabel('Your name').fill('Lea')
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/join\?code=A3BF92C1$/)
  await expect(page.getByLabel('Trip code')).toHaveValue('A3BF92C1')
})
