import { chromium } from "playwright"
const browser = await chromium.launch()
const errors = []
const open = async (name) => {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage()
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`))
  await page.goto("http://localhost:3311/")
  await page.waitForFunction(() => document.querySelector("yrby-document")?.current)
  return page
}
const a = await open("A"), b = await open("B")
await a.click("#invite")
await a.waitForFunction(() => document.querySelectorAll(".avatar.is-agent").length > 0, null, { timeout: 15000 })
console.log("agent joined; avatars in B:", await b.locator(".avatar").count())
const ask = async (text) => {
  const before = await b.locator(".ask").count()
  await a.fill("#ask-input", text)
  await a.press("#ask-input", "Enter")
  const t0 = Date.now()
  await b.waitForFunction((n) => { const all = document.querySelectorAll(".ask"); const l = all[all.length - 1]; return all.length > n && /is-(done|failed)/.test(l.className) }, before, { timeout: 90000 })
  console.log(`\n> ${text}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  console.log("  reply:", await b.locator(".ask .ask-reply").last().innerText())
  await b.waitForTimeout(1200)
  console.log("  B sees:", await b.locator(".summary").innerText(), "| rows", await b.locator("tbody tr.row").count(), "| expanded", await b.locator("tr.detail").count(), "| select", await b.locator("select").inputValue())
}
await ask("Show me the overdue invoices, biggest first")
await ask("Open the two largest ones so we can see their notes")
await ask("What's the total of what we're looking at, and who owes the most?")
await ask("Now just Huckleberry Pie, any status")
await b.screenshot({ path: "agent-b.png" })
console.log("errors", errors)
await browser.close()
