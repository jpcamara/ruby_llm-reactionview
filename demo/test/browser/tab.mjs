// One tab asks <page-agent>; a second tab watches the shared view follow.
import { chromium } from "playwright"
const b = await chromium.launch()
const a = await b.newPage(), w = await b.newPage()
const errors = []
for (const p of [a, w]) p.on("pageerror", (e) => errors.push(e.message))
for (const p of [a, w]) { await p.goto("http://localhost:3311"); await p.waitForFunction(() => window.HerbRuntime?.state) }
await a.waitForTimeout(800)
await a.click("page-agent summary")
const state = (p) => p.evaluate(() => ({
  summary: document.querySelector(".summary")?.textContent.replace(/\s+/g, " ").trim(),
  rows: document.querySelectorAll("tr.row").length,
  open: document.querySelectorAll('tr.detail[data-open="true"]').length,
  breakdown: document.querySelector(".breakdown")?.dataset.open,
}))
// Counts how many times the reply's text grew while streaming.
await a.evaluate(() => {
  window.growth = 0
  const list = document.querySelector("page-agent").shadowRoot.querySelector("ol")
  new MutationObserver(() => window.growth++).observe(list, { subtree: true, characterData: true, childList: true })
})
const asks = [
  "Clear any search and show only overdue invoices, biggest first",
  "Open the largest one and show the totals breakdown",
  "What did I ask you first?",
  "Close everything you opened",
]
for (const prompt of asks) {
  const before = await a.locator("page-agent li.agent").count()
  const t = Date.now()
  await a.evaluate(() => { window.growth = 0 })
  await a.fill("page-agent input", prompt); await a.press("page-agent input", "Enter")
  await a.waitForFunction((n) => {
    const items = document.querySelector("page-agent").shadowRoot.querySelectorAll("li.agent")
    return items.length > n && !["…", ""].includes(items[items.length - 1].textContent) && !window.pending
  }, before, { timeout: 90000 })
  await a.waitForFunction(() => new Promise((r) => { const g = window.growth; setTimeout(() => r(window.growth === g), 600) }))
  const reply = await a.evaluate(() => [...document.querySelector("page-agent").shadowRoot.querySelectorAll("li.agent")].at(-1).textContent)
  console.log(`> ${prompt}  (${((Date.now() - t) / 1000).toFixed(1)}s, ${await a.evaluate(() => window.growth)} updates)`)
  console.log("  reply:", reply)
  await a.waitForTimeout(700)
  console.log("  asker:", JSON.stringify(await state(a)), "\n  other:", JSON.stringify(await state(w)))
}
console.log("errors", errors)
await b.close()
