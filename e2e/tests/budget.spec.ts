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

test('settle up says who pays whom, and Pay opens the PayPal.Me link with the amount', async ({ browser }) => {
  const { mia, theo } = await budgetWithTwo(browser)
  async function addExpense(page: Page, what: string, amount: string) {
    await page.getByRole('button', { name: '+ Add expense' }).click()
    const form = page.getByRole('dialog', { name: 'Add expense' })
    await form.getByLabel('What was it?').fill(what)
    await form.getByLabel('Amount', { exact: true }).fill(amount)
    await form.getByRole('button', { name: 'Add expense' }).click()
    await expect(form).toBeHidden()
  }

  await addExpense(mia, 'Apartment', '90')
  const settle = (page: Page) => page.getByRole('region', { name: 'Settle up' })
  await expect(settle(mia)).toContainText('Theo owes youNot paid€45')
  // Mia has no PayPal.Me link or MobilePay number yet, so Theo cannot pay with one tap
  await expect(settle(theo)).toContainText('You owe MiaNot paid€45')
  await expect(settle(theo)).toContainText('Mia has not added a way to pay yet')

  // Mia adds her link in the profile; Theo's Pay button opens it with the amount
  const token = await mia.evaluate(() => localStorage.getItem('tp_token'))
  expect((await mia.request.fetch('/api/auth/profile', { method: 'PATCH', data: { paypalMe: 'paypal.me/MiaTravels' }, headers: { Authorization: `Bearer ${token}` } })).ok()).toBe(true)
  await theo.reload()
  await expect(settle(theo).getByRole('link', { name: 'Pay Mia €45 with PayPal' })).toHaveAttribute('href', 'https://paypal.me/MiaTravels/45.00EUR')

  // With a MobilePay number too, Theo sees it next to the Pay button and can copy it
  expect((await mia.request.fetch('/api/auth/profile', { method: 'PATCH', data: { mobilePay: '12 34 56 78' }, headers: { Authorization: `Bearer ${token}` } })).ok()).toBe(true)
  await theo.reload()
  await expect(settle(theo)).toContainText('Send €45 to Mia with MobilePay: +45 12 34 56 78')
  await theo.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await settle(theo).getByRole('button', { name: 'Copy number' }).click()
  expect(await theo.evaluate(() => navigator.clipboard.readText())).toBe('+4512345678')
  await settle(theo).getByRole('button', { name: 'Copy amount' }).click()
  expect(await theo.evaluate(() => navigator.clipboard.readText())).toBe('45')

  // Theo pays for the dinner: now they are even
  await addExpense(theo, 'Dinner', '90')
  await expect(settle(mia)).toContainText('Everyone is even')
})

test('a payment is marked as paid by the payer and confirmed by the one who got it', async ({ browser }) => {
  const { mia, theo } = await budgetWithTwo(browser)
  await mia.getByRole('button', { name: '+ Add expense' }).click()
  const form = mia.getByRole('dialog', { name: 'Add expense' })
  await form.getByLabel('What was it?').fill('Apartment')
  await form.getByLabel('Amount', { exact: true }).fill('90')
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(form).toBeHidden()

  const settle = (page: Page) => page.getByRole('region', { name: 'Settle up' })
  const payments = (page: Page) => settle(page).getByRole('list', { name: 'Payments' })
  // Not paid: Theo marks it, also without a PayPal.Me link (e.g. paid in cash)
  await settle(theo).getByRole('button', { name: 'I have paid' }).click()
  await expect(settle(theo)).toContainText('Everyone has paid their part.')
  await expect(payments(theo)).toContainText('You paid MiaWaiting for Mia€45')

  // Mia sees it at once and says it did not arrive: Theo owes it again
  await expect(payments(mia)).toContainText('Theo paid youDid you get it?€45')
  await payments(mia).getByRole('button', { name: 'Not received' }).click()
  await expect(settle(theo)).toContainText('You owe MiaNot paid€45')
  await expect(payments(theo)).toBeHidden()

  // Theo marks it again and takes it back, then marks it once more and Mia confirms it
  await settle(theo).getByRole('button', { name: 'I have paid' }).click()
  await payments(theo).getByRole('button', { name: 'Undo' }).click()
  await expect(settle(theo)).toContainText('You owe MiaNot paid€45')
  await settle(theo).getByRole('button', { name: 'I have paid' }).click()
  await payments(mia).getByRole('button', { name: 'Confirm' }).click()
  await expect(payments(theo)).toContainText('You paid MiaConfirmed ✓€45')
  await expect(payments(mia).getByRole('button')).toHaveCount(0)

  // A new expense makes a new debt; what was paid still counts
  await mia.getByRole('button', { name: '+ Add expense' }).click()
  await form.getByLabel('What was it?').fill('Taxi')
  await form.getByLabel('Amount', { exact: true }).fill('20')
  await form.getByRole('button', { name: 'Add expense' }).click()
  await expect(settle(theo)).toContainText('You owe MiaNot paid€10')
})
