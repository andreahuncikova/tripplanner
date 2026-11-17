import { expect, test, type Browser, type Page } from '@playwright/test'

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`
const pad = (n: number) => String(n).padStart(2, '0')
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

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

// Mia and Theo in a trip whose destination and dates are known, so the budget is open, both on the Budget tab
async function budgetWithTwo(browser: Browser) {
  const mia = await (await browser.newContext()).newPage()
  const theo = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')
  await signUp(theo, 'Theo')
  const trip = { name: 'Lisbon', destination: 'Lisbon', currency: 'EUR', dates: { mode: 'known', start: inDays(20), end: inDays(24) } }
  const { inviteCode: code } = await (await call(mia, 'POST', '/api/groups', trip)).json()
  expect((await call(theo, 'POST', `/api/groups/${code}/join`)).ok()).toBe(true)
  await mia.goto(`/trips/${code}/budget`)
  await theo.goto(`/trips/${code}/budget`)
  return { mia, theo, code: code as string }
}

const total = (page: Page, label: string) => page.getByText(label, { exact: true }).filter({ visible: true }).locator('..')

test('an expense split equally shows up for the other member, with the totals', async ({ browser }) => {
  const { mia, theo } = await budgetWithTwo(browser)
  await mia.getByRole('button', { name: '+ Add expense' }).click()
  const form = mia.getByRole('dialog', { name: 'Add expense' })
  await form.getByLabel('What was it?').fill('Apartment')
  await form.getByLabel('Amount', { exact: true }).fill('90')
  // Both are chosen by default, so each pays half
  await expect(form.getByText('€45')).toHaveCount(2)
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(form).toBeHidden()

  await expect(theo.getByRole('listitem').filter({ hasText: 'Apartment' })).toContainText('Mia paid · split between everyone')
  await expect(total(theo, 'Group spent')).toContainText('€90')
  await expect(total(theo, 'You paid')).toContainText('€0')
  await expect(total(theo, 'Your share')).toContainText('€45')
  await expect(total(mia, 'You paid')).toContainText('€90')
})

test('exact amounts must add up before the expense can be added', async ({ browser }) => {
  const { mia, theo } = await budgetWithTwo(browser)
  await mia.getByRole('button', { name: '+ Add expense' }).click()
  const form = mia.getByRole('dialog', { name: 'Add expense' })
  await form.getByLabel('What was it?').fill('Dinner')
  await form.getByLabel('Amount', { exact: true }).fill('30')
  await form.getByText('Exact amounts').click()

  await form.getByLabel('You', { exact: true }).fill('10')
  await form.getByLabel('Theo', { exact: true }).fill('15')
  await expect(form.getByText('€5 left to split')).toBeVisible()
  await expect(form.getByRole('button', { name: 'Add expense' })).toBeDisabled()

  await form.getByLabel('Theo', { exact: true }).fill('25')
  await expect(form.getByText('€5 too much')).toBeVisible()
  // A comma works as the decimal point too
  await form.getByLabel('Theo', { exact: true }).fill('19,50')
  await form.getByLabel('You', { exact: true }).fill('10,50')
  await expect(form.getByText('The amounts add up ✓')).toBeVisible()
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(form).toBeHidden()

  await expect(theo.getByRole('listitem').filter({ hasText: 'Dinner' })).toContainText('exact amounts, 2 people')
  await expect(total(theo, 'Your share')).toContainText('€19.50')
  await expect(total(mia, 'Your share')).toContainText('€10.50')
})

test('an expense in another currency is converted to the group currency', async ({ browser }) => {
  const { mia } = await budgetWithTwo(browser)
  await mia.getByRole('button', { name: '+ Add expense' }).click()
  const form = mia.getByRole('dialog', { name: 'Add expense' })
  await form.getByLabel('What was it?').fill('Museum')
  await form.getByLabel('Amount', { exact: true }).fill('300')
  await form.getByLabel('Currency', { exact: true }).selectOption('DKK')
  await expect(form.getByText(/≈ €\d+.* at today's rate/)).toBeVisible()
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(mia.getByRole('listitem').filter({ hasText: 'Museum' })).toContainText('DKK 300')
})

// Opens a trip with a plain socket, as the app does, but without the screen, so the test can send what the
// screen does not offer. Resolves with the socket and the trip it got back.
async function openTrip(page: Page, code: string) {
  const { io } = await import('socket.io-client')
  const token = await page.evaluate(() => localStorage.getItem('tp_token'))
  const socket = io('http://localhost:3100', { auth: { token }, transports: ['websocket'] })
  const trip = await new Promise<{ expenses: { _id: string; description: string }[] }>((resolve, reject) => {
    socket.once('joined', resolve)
    socket.once('connect_error', reject)
    socket.emit('join', { code })
  })
  return { socket, trip }
}

test('only the person who added an expense can change or delete it', async ({ browser }) => {
  const { mia, theo, code } = await budgetWithTwo(browser)
  // Theo adds an expense; Mia is the organiser
  await theo.getByRole('button', { name: '+ Add expense' }).click()
  let form = theo.getByRole('dialog', { name: 'Add expense' })
  await form.getByLabel('What was it?').fill('Tickets')
  await form.getByLabel('Amount', { exact: true }).fill('40')
  await expect(form.getByText('Only you can edit or delete this expense later.')).toBeVisible()
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(form).toBeHidden()

  // Mia sees it, but cannot edit it, although she is the organiser
  await expect(mia.getByRole('listitem').filter({ hasText: 'Tickets' })).toBeVisible()
  await expect(mia.getByRole('button', { name: 'Edit Tickets' })).toHaveCount(0)

  // Not even by sending the events herself: the server says no
  const { socket, trip } = await openTrip(mia, code)
  const id = trip.expenses.find(e => e.description === 'Tickets')!._id
  const edit = await socket.emitWithAck('expense:edit', { id, description: 'Mine now', amount: 1, currency: 'EUR', paidByUserId: '', splitAmongUserIds: [] })
  const remove = await socket.emitWithAck('expense:remove', id)
  socket.disconnect()
  expect(edit).toEqual({ error: 'Only the person who added this expense can change it' })
  expect(remove).toEqual({ error: 'Only the person who added this expense can delete it' })

  // Theo changes it, and Mia sees the change at once
  await theo.getByRole('button', { name: 'Edit Tickets' }).click()
  form = theo.getByRole('dialog', { name: 'Edit expense' })
  await expect(form.getByLabel('Amount', { exact: true })).toHaveValue('40')
  await form.getByLabel('What was it?').fill('Museum tickets')
  await form.getByLabel('Amount', { exact: true }).fill('50')
  await form.getByRole('button', { name: 'Save changes' }).click()
  await expect(form).toBeHidden()
  await expect(mia.getByRole('listitem').filter({ hasText: 'Museum tickets' })).toContainText('€50')

  // And deletes it after a question
  await theo.getByRole('button', { name: 'Edit Museum tickets' }).click()
  form = theo.getByRole('dialog', { name: 'Edit expense' })
  await form.getByRole('button', { name: 'Delete expense' }).click()
  await form.getByRole('group', { name: 'Delete this expense?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(mia.getByRole('listitem').filter({ hasText: 'Museum tickets' })).toHaveCount(0)
})
