import { chromium } from "playwright"
const b = await chromium.launch(); const p = await b.newPage()
const errors = []; p.on("pageerror", (e) => errors.push(e.message))
await p.goto("http://localhost:3311/customers"); await p.waitForFunction(() => window.HerbRuntime?.state); await p.waitForTimeout(800)
const pinned = () => p.evaluate(() => [...document.querySelectorAll('.card[data-pinned="true"] h2')].map((h) => h.textContent))
for (const prompt of ["Pin Pioneer Bikes and whoever owes the most", "Unpin Pioneer Bikes"]) {
  const before = await p.locator("page-agent li.agent").count()
  const t = Date.now()
  await p.fill("page-agent input", prompt); await p.press("page-agent input", "Enter")
  await p.waitForFunction((n) => { const i = document.querySelector("page-agent").shadowRoot.querySelectorAll("li.agent"); return i.length > n && !["…", ""].includes(i[i.length - 1].textContent) }, before, { timeout: 90000 })
  await p.waitForTimeout(1500)
  console.log(`> ${prompt} (${((Date.now() - t) / 1000).toFixed(1)}s)\n  reply: ${await p.evaluate(() => [...document.querySelector("page-agent").shadowRoot.querySelectorAll("li.agent")].at(-1).textContent)}\n  pinned: ${JSON.stringify(await pinned())}`)
}
console.log("errors", errors); await b.close()
