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

const auth = async (page: Page) => ({ Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('tp_token'))}` })

// Mia's trip to Bali, 12 – 15 March 2027 (three nights), which Theo joined.
// Destination and dates are known, so the planning is done and the trip opens on the itinerary.
async function tripWithDates(browser: Browser) {
  const mia = await (await browser.newContext()).newPage()
  const theo = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')
  await signUp(theo, 'Theo')
  const { inviteCode: code } = await (await mia.request.post('/api/groups', {
    data: { name: 'Bali', destination: 'Bali, Indonesia', currency: 'EUR', dates: { mode: 'known', start: '2027-03-12', end: '2027-03-15' } },
    headers: await auth(mia),
  })).json()
  expect((await theo.request.post(`/api/groups/${code}/join`, { headers: await auth(theo) })).ok()).toBe(true)
  return { mia, theo, code: code as string }
}

async function addActivity(page: Page, what: string, day: string, time = '', place = '') {
  await page.getByRole('button', { name: 'Add activity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add activity' })
  await dialog.getByLabel('What').fill(what)
  await dialog.getByLabel('Day').selectOption({ label: day })
  if (time) await dialog.getByLabel('Time').fill(time)
  if (place) await dialog.getByLabel('Place').fill(place)
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('a trip with dates opens on the itinerary, and activities appear for everyone in order of time', async ({ browser }) => {
  const { mia, theo, code } = await tripWithDates(browser)
  await mia.goto(`/trips/${code}`)
  await expect(mia).toHaveURL(new RegExp(`/trips/${code}/itinerary$`))
  // A trip still choosing its destination opens on the plan instead
  const { inviteCode: open } = await (await mia.request.post('/api/groups', { data: { name: 'Somewhere' }, headers: await auth(mia) })).json()
  await mia.goto(`/trips/${open}`)
  await expect(mia).toHaveURL(new RegExp(`/trips/${open}/plan$`))
  await mia.goto(`/trips/${code}/itinerary`)
  await theo.goto(`/trips/${code}/itinerary`)

  // Four days; the three nights have no stay yet
  const strip = mia.getByRole('group', { name: 'Days of the trip' })
  await expect(strip.getByRole('button')).toHaveCount(4)
  await expect(strip.getByRole('button', { name: 'Friday 12 March, no stay booked for the night' })).toHaveAttribute('aria-pressed', 'true')
  await expect(mia.getByText('No stay booked for 12 – 15 Mar (3 nights).')).toBeVisible()

  await addActivity(mia, 'Dinner in Ubud', 'Day 1 · 12 Mar', '19:30', 'Locavore, Ubud')
  await addActivity(mia, 'Land in Denpasar', 'Day 1 · 12 Mar', '10:40')
  await addActivity(mia, 'Rafting', 'No day yet')

  // Theo did not reload: the first day is in order of time, and the idea is listed apart
  const day = theo.getByRole('list', { name: 'Activities on Friday 12 March' })
  await expect(day.getByRole('listitem')).toHaveText([/10:40\s*Land in Denpasar/, /19:30\s*Dinner in Ubud.*Locavore, Ubud/])
  await expect(theo.getByRole('region', { name: 'Ideas without a day' })).toContainText('Rafting')
  await expect(theo.getByRole('link', { name: 'Locavore, Ubud' })).toHaveAttribute('href', /google\.com\/maps\/search/)

  // Only who added an activity, or the organiser, can change it
  await expect(theo.getByRole('button', { name: 'Change Dinner in Ubud' })).toHaveCount(0)
  await mia.getByRole('button', { name: 'Change Rafting' }).click()
  const edit = mia.getByRole('dialog', { name: 'Change activity' })
  await edit.getByLabel('Day').selectOption({ label: 'Day 2 · 13 Mar' })
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(theo.getByRole('region', { name: 'Ideas without a day' })).toHaveCount(0)
  await theo.getByRole('group', { name: 'Days of the trip' }).getByRole('button', { name: /^Saturday 13 March/ }).click()
  await expect(theo.getByRole('list', { name: 'Activities on Saturday 13 March' })).toContainText('Rafting')
})

test('the stay for each night shows on its day', async ({ browser }) => {
  const { mia, code } = await tripWithDates(browser)
  await mia.goto(`/trips/${code}/stays`)
  await mia.getByLabel('Paste a stay link').fill('https://jungle-villa.invalid/rooms/1')
  await mia.getByRole('button', { name: 'Add', exact: true }).click()
  await mia.getByRole('button', { name: 'Choose nights for jungle-villa.invalid' }).click()
  const nights = mia.getByRole('dialog', { name: 'Nights' })
  await nights.getByLabel('Check-out').fill('2027-03-14')
  await nights.getByRole('button', { name: 'Save' }).click()
  await mia.getByRole('button', { name: 'Booked: jungle-villa.invalid' }).click()

  await mia.getByRole('link', { name: 'Itinerary' }).first().click()
  await expect(mia.getByText('night 1 of 2 · check-out 14 Mar')).toBeVisible()
  await mia.getByRole('group', { name: 'Days of the trip' }).getByRole('button', { name: /^Saturday 13 March/ }).click()
  await expect(mia.getByText('night 2 of 2 · check-out 14 Mar')).toBeVisible()
  // The third night still has no stay
  await mia.getByRole('group', { name: 'Days of the trip' }).getByRole('button', { name: 'Sunday 14 March, no stay booked for the night' }).click()
  await expect(mia.getByRole('link', { name: /No stay for this night yet/ })).toBeVisible()
  await expect(mia.getByText('No stay booked for 14 – 15 Mar (1 night).')).toBeVisible()
})
