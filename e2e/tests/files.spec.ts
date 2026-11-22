import { expect, test, type Page } from '@playwright/test'

// The file storage through the real server and database: upload, read, who may do what.
// Only the API is used; the screens that upload (profile photo, chat) have their own tests.

const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`

async function signUp(page: Page, name: string) {
  await page.goto('/login?mode=signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(newEmail())
  await page.getByLabel('Password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

const token = (page: Page) => page.evaluate(() => localStorage.getItem('tp_token'))

async function upload(page: Page, query: string, body: Buffer, name = 'photo.jpg') {
  return page.request.post(`/api/files${query}`, {
    data: body,
    headers: { Authorization: `Bearer ${await token(page)}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name) },
  })
}

// The first bytes of a JPG are enough: the server reads the type from them
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('a small test photo')])
const pdf = Buffer.from('%PDF-1.7\n% a test ticket\n')

test('a profile photo is saved and can be opened from its address', async ({ browser }) => {
  const mia = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')

  const res = await upload(mia, '?kind=avatar', jpeg, 'me.jpg')
  expect(res.status()).toBe(201)
  const file = await res.json()
  expect(file).toMatchObject({ type: 'image/jpeg', size: jpeg.length, name: 'me.jpg' })
  expect(file.url).toMatch(/^\/api\/files\/[a-f0-9]{48}$/)

  // No log-in needed to read it, like any <img>; the browser must not guess another type
  const read = await (await browser.newContext()).request.get(`http://localhost:5180${file.url}`)
  expect(read.status()).toBe(200)
  expect(read.headers()['content-type']).toBe('image/jpeg')
  expect(read.headers()['x-content-type-options']).toBe('nosniff')
  expect(Buffer.from(await read.body()).equals(jpeg)).toBe(true)

  // Only a photo can be a profile photo, and a page named .jpg is not a photo
  expect((await upload(mia, '?kind=avatar', pdf, 'ticket.pdf')).status()).toBe(400)
  const html = await upload(mia, '?kind=avatar', Buffer.from('<html><script>alert(1)</script></html>'), 'evil.jpg')
  expect(html.status()).toBe(400)
  expect((await html.json()).error).toBe('Please choose a JPG, PNG or WebP photo')

  // Without a log-in nothing can be uploaded
  const anon = await (await browser.newContext()).request.post('http://localhost:5180/api/files?kind=avatar', { data: jpeg })
  expect(anon.status()).toBe(401)
})

test('chat files belong to a trip: only members upload, only the author deletes, and they go with the trip', async ({ browser }) => {
  const mia = await (await browser.newContext()).newPage()
  const theo = await (await browser.newContext()).newPage()
  await signUp(mia, 'Mia')
  await signUp(theo, 'Theo')
  const auth = async (p: Page) => ({ Authorization: `Bearer ${await token(p)}` })
  const { inviteCode: code } = await (await mia.request.post('/api/groups', { data: { name: 'Lisbon' }, headers: await auth(mia) })).json()

  // Theo is not in the trip yet
  expect((await upload(theo, `?kind=chat&trip=${code}`, pdf, 'ticket.pdf')).status()).toBe(404)

  const res = await upload(mia, `?kind=chat&trip=${code}`, pdf, 'Lístky.pdf')
  expect(res.status()).toBe(201)
  const file = await res.json()
  const read = await mia.request.get(file.url)
  expect(read.headers()['content-type']).toBe('application/pdf')
  expect(read.headers()['content-disposition']).toBe(`attachment; filename*=UTF-8''${encodeURIComponent('Lístky.pdf')}`)

  // Only who uploaded a file can delete it
  expect((await theo.request.delete(file.url, { headers: await auth(theo) })).status()).toBe(404)
  const photo = await (await upload(mia, `?kind=chat&trip=${code}`, jpeg)).json()
  expect((await mia.request.delete(photo.url, { headers: await auth(mia) })).status()).toBe(200)
  expect((await mia.request.get(photo.url)).status()).toBe(404)

  // Deleting the trip deletes its files
  expect((await mia.request.delete(`/api/groups/${code}`, { headers: await auth(mia) })).ok()).toBe(true)
  await expect.poll(async () => (await mia.request.get(file.url)).status()).toBe(404)
})
