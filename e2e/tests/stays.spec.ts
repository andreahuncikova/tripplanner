import { expect, test, type Browser, type Page } from '@playwright/test'

// The links use the .invalid domain, which never exists, so the tests need no internet:
// the preview cannot load and the stay is saved with only its address, as for a site that blocks previews.

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`

async function signUp(page: Page, name: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

async function call(page: Page, method: 'POST', path: string, data?: object) {
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` } })
}

async function tripWithTwo(browser: Browser) {
  const mia = await (await browser.newContext()).newPage()
  const theo = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')
  await signUp(theo, 'Theo')
  const { inviteCode: code } = await (await call(mia, 'POST', '/api/groups', { name: 'Bali with friends' })).json()
  expect((await call(theo, 'POST', `/api/groups/${code}/join`)).ok()).toBe(true)
  return { mia, theo, code: code as string }
}

const areas = (page: Page) => page.getByRole('group', { name: 'Areas' })

async function addStay(page: Page, url: string) {
  await page.getByLabel('Paste a stay link').fill(url)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByLabel('Paste a stay link')).toHaveValue('')
}

test('the group saves stays into areas and likes them, and everyone sees it right away', async ({ browser }) => {
  const { mia, theo, code } = await tripWithTwo(browser)
  await mia.goto(`/trips/${code}/stays`)
  await theo.goto(`/trips/${code}/stays`)
  await expect(mia.getByText('No stays yet.')).toBeVisible()

  // Mia adds the area Ubud; it opens, so the next stay goes into it
  await areas(mia).getByRole('button', { name: '+ Add area' }).click()
  const dialog = mia.getByRole('dialog', { name: 'Areas' })
  await dialog.getByLabel('New area').fill('Ubud')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog.getByText('Ubud')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(areas(mia).getByRole('button', { name: 'Ubud · 0' })).toHaveAttribute('aria-pressed', 'true')

  await addStay(mia, 'https://jungle-villa.invalid/rooms/1')
  await expect(areas(mia).getByRole('button', { name: 'Ubud · 1' })).toBeVisible()
  await expect(mia.getByRole('list', { name: 'Stays in Ubud' }).getByRole('link', { name: 'jungle-villa.invalid' })).toBeVisible()

  // Theo did not reload: he sees the area and the stay, and likes it
  await expect(areas(theo).getByRole('button', { name: 'Ubud · 1' })).toBeVisible()
  await theo.getByRole('button', { name: 'Like, 0 likes' }).click()
  await expect(theo.getByRole('button', { name: 'Liked by you, 1 like' })).toBeVisible()
  await expect(mia.getByRole('button', { name: 'Like, 1 like' })).toBeVisible()

  // The same link twice is refused
  await mia.getByLabel('Paste a stay link').fill('https://jungle-villa.invalid/rooms/1')
  await mia.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(mia.getByText('This stay is already saved')).toBeVisible()

  // Only who added it (or the organiser) can remove it
  await expect(theo.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
  await mia.getByRole('button', { name: 'Remove jungle-villa.invalid' }).click()
  await expect(areas(theo).getByRole('button', { name: 'All · 0' })).toBeVisible()
})

test('a stay moves to another area and an area can be renamed', async ({ browser }) => {
  const { mia, theo, code } = await tripWithTwo(browser)
  await mia.goto(`/trips/${code}/stays`)
  await addStay(mia, 'https://rice-bungalows.invalid/stay')

  await areas(mia).getByRole('button', { name: '+ Add area' }).click()
  const dialog = mia.getByRole('dialog', { name: 'Areas' })
  await dialog.getByLabel('New area').fill('Uluwatu')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await dialog.getByRole('button', { name: 'Rename Uluwatu' }).click()
  await dialog.getByLabel('New name for Uluwatu').fill('Canggu')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Canggu')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()

  await areas(mia).getByRole('button', { name: /^All/ }).click()
  await mia.getByLabel('Area for rice-bungalows.invalid').selectOption({ label: 'Canggu' })
  await expect(areas(mia).getByRole('button', { name: 'Canggu · 1' })).toBeVisible()

  await theo.goto(`/trips/${code}/stays`)
  await areas(theo).getByRole('button', { name: 'Canggu · 1' }).click()
  await expect(theo.getByRole('list', { name: 'Stays in Canggu' }).getByRole('link', { name: 'rice-bungalows.invalid' })).toBeVisible()
})
