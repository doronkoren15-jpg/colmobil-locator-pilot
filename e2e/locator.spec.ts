import { test, expect } from '@playwright/test'
test('real data: Hebrew selection, all eight brands, live filters, links and no query network', async ({
  page,
}, testInfo) => {
  const exceptions: string[] = []
  page.on('pageerror', (e) => exceptions.push(e.message))
  await page.goto('/')
  await expect(page.getByLabel('יישוב הלקוח')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByLabel('מותג').locator('option')).toHaveCount(9)
  await page.getByLabel('יישוב הלקוח').fill('רענ')
  await page.getByRole('option').filter({ hasText: 'רעננה' }).click()
  await expect(page.getByTestId('result-card')).toHaveCount(5)
  await page.screenshot({
    path: `reports/preview-${testInfo.project.name.includes('Mobile') ? 'mobile' : 'desktop'}.png`,
    fullPage: true,
  })
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  for (const brand of [
    'Hyundai',
    'Mitsubishi',
    'JAECOO',
    'OMODA',
    'ORA',
    'Mercedes-Benz',
    'Genesis',
    'smart',
  ]) {
    await page.getByLabel('מותג').selectOption(brand)
    const cards = page.getByTestId('result-card')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeLessThanOrEqual(5)
    for (const href of await cards
      .locator('a.waze-button')
      .evaluateAll((a) => a.map((l) => l.getAttribute('href')))) {
      const u = new URL(href!)
      expect(u.hostname).toBe('www.waze.com')
      expect(u.searchParams.get('ll')).toMatch(/^\d+(\.\d+)?,\d+(\.\d+)?$/)
    }
  }
  await page.getByRole('button', { name: 'טרייד אין', exact: true }).click()
  await expect(page.getByLabel('מותג')).toBeDisabled()
  await expect(page.getByTestId('result-card')).toHaveCount(5)
  await page.getByRole('button', { name: 'יוקרה', exact: true }).click()
  await expect(page.getByTestId('result-card')).toHaveCount(5)
  expect(requests).toEqual([])
  expect(exceptions).toEqual([])
  const phone = page.getByTestId('result-card').first().locator('a[href^="tel:"]')
  await expect(phone).toHaveAttribute('href', /^tel:(?:0|\*)\d+$/)
  const width = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }))
  expect(width.document).toBeLessThanOrEqual(width.viewport)
  await page.getByLabel('יישוב הלקוח').fill('איןיישובכזה')
  await expect(page.getByText('היישוב לא נמצא. נסו שם אחר או כתיב חלופי.')).toBeVisible()
  await expect(page.getByTestId('result-card')).toHaveCount(0)
})
test('demo, keyboard selection, no results, missing location and return to real data', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'פתיחת מצב הדגמה' }).click()
  await expect(page.getByText('מצב הדגמה בלבד', { exact: true })).toBeVisible()
  await page.getByLabel('יישוב הלקוח').fill('דמו')
  await page.getByLabel('יישוב הלקוח').press('ArrowDown')
  await page.getByLabel('יישוב הלקוח').press('Enter')
  await expect(page.getByTestId('result-card')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'ניווט מושבת בדמו' }).first()).toBeDisabled()
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0)
  await page.getByRole('button', { name: 'יוקרה', exact: true }).click()
  await expect(page.getByText('אין נקודות מכירה מאומתות למסננים האלה')).toBeVisible()
  await page.getByLabel('יישוב הלקוח').fill('ללא מיקום')
  await page.getByRole('listbox').getByRole('option').click()
  await expect(page.getByText('חסרה נקודת מיקום ליישוב הזה')).toBeVisible()
  await page.getByRole('button', { name: 'חזרה לנתוני אמת' }).click()
  await expect(page.getByLabel('יישוב הלקוח')).toHaveValue('')
  await expect(page.getByText('מצב הדגמה בלבד', { exact: true })).toHaveCount(0)
})
test('loading failure, retry, and report availability', async ({ page }) => {
  let fail = true
  await page.route('**/data/official.json', async (route) => {
    if (fail) await route.fulfill({ status: 503, body: 'unavailable' })
    else await route.continue()
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'ניסיון חוזר' }).click()
  await expect(page.getByLabel('יישוב הלקוח')).toBeVisible()
  const report = await page.request.get('/data-status.html')
  expect(report.ok()).toBeTruthy()
  expect(await report.text()).toContain('כיסוי אולמות רכב חדש')
})
