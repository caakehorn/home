import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(String(e).slice(0,200)))
async function enter() {
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500)
    const cb = page.locator('input[type=checkbox]:visible').first()
    if (await cb.count()) await cb.check().catch(()=>{})
    const btn = page.getByRole('button', { name: /I AGREE|ENTER ANYWAY|SUBMIT|CONTINUE|^ENTER$/i }).first()
    if (await btn.count() && await btn.isVisible().catch(()=>false)) { await btn.click().catch(()=>{}); continue }
    if (await page.locator('.inst').count()) return
  }
}
for (const id of process.argv.slice(2)) {
  errs.length = 0
  await page.goto('http://127.0.0.1:8813/leviathan/' + id, { waitUntil: 'networkidle', timeout: 60000 })
  await enter(); await page.waitForTimeout(2800)
  const info = await page.evaluate(() => ({
    title: document.querySelector('.inst__title')?.innerText.replace(/\n/g,' '),
    state: document.querySelector('.inst__state')?.innerText?.slice(0,80) ?? null,
    rows: document.querySelectorAll('.pt-row, .pt-card, .cen__row').length,
    facts: document.querySelector('.pt-facts')?.innerText.replace(/\n/g,' | ').slice(0,220) ?? null,
  }))
  console.log(id.padEnd(10), JSON.stringify(info), errs.length ? 'ERR:'+errs[0] : '')
  await page.screenshot({ path: `/tmp/i-${id}.jpg`, type: 'jpeg', quality: 78 })
}
await b.close()
