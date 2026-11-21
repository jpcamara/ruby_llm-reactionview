// Two tabs side by side. Ada asks the in-page agent; Grace's tab follows through yrby.
import { chromium } from "playwright"
const browser = await chromium.launch()
const size = { width: 1280, height: 860 }
const open = async (name) => {
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: "demo-rec", size } })
  await ctx.addInitScript((name) => {
    const colors = { Ada: "#e76f51", Grace: "#2a9d8f" }
    sessionStorage.setItem("me", JSON.stringify({ name, color: colors[name] }))
  }, name)
  const page = await ctx.newPage()
  await page.goto("http://localhost:3311/")
  await page.waitForFunction(() => window.HerbRuntime?.state && document.querySelector("yrby-document")?.current)
  return { ctx, page }
}
const A = await open("Ada"), B = await open("Grace")
const a = A.page, b = B.page
const pause = (ms) => a.waitForTimeout(ms)
const ask = async (page, text) => {
  const before = await page.locator("page-agent li.agent").count()
  const t = Date.now()
  await page.click("page-agent input")
  await page.keyboard.type(text, { delay: 35 })
  await page.keyboard.press("Enter")
  await page.waitForFunction((n) => {
    const items = document.querySelector("page-agent").shadowRoot.querySelectorAll("li.agent")
    return items.length > n && !["…", ""].includes(items[items.length - 1].textContent) && !window.pending
  }, before, { timeout: 90000 })
  await page.waitForFunction(() => new Promise((r) => {
    const read = () => [...document.querySelector("page-agent").shadowRoot.querySelectorAll("li.agent")].at(-1).textContent
    const s = read(); setTimeout(() => r(read() === s), 800)
  }))
  console.log(`> ${text} (${((Date.now() - t) / 1000).toFixed(1)}s)`)
  console.log("  ", await page.evaluate(() => [...document.querySelector("page-agent").shadowRoot.querySelectorAll("li.agent")].at(-1).textContent))
  await pause(2500)
}
await pause(1500)
await a.click("page-agent summary"); await pause(800)
await ask(a, "Show only overdue invoices, biggest first")
await ask(a, "Open the largest one and show the totals breakdown")
await ask(a, "What did I ask you first?")
await ask(a, "Close everything you opened and show all invoices again")
await a.goto("http://localhost:3311/customers")
await a.waitForFunction(() => window.HerbRuntime?.state); await pause(1500)
await ask(a, "Pin Pioneer Bikes and whoever owes the most")
await pause(1500)
const va = a.video(), vb = b.video()
await A.ctx.close(); await B.ctx.close()
console.log(await va.path()); console.log(await vb.path())
await browser.close()
