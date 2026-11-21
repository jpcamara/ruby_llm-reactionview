// apply() answers with the rows a server refetch renders.
import { chromium } from "playwright"
const b = await chromium.launch()
const p = await b.newPage()
const errors = []
p.on("pageerror", (e) => errors.push(e.message))
// The page also shares its view through yrby. Keep the websocket closed so
// only apply() and Herb change the states here.
await p.routeWebSocket(/\/cable/, (ws) => ws.close())
await p.goto("http://localhost:3311/")
await p.waitForFunction(() => window.HerbRuntime?.state)
await p.waitForTimeout(800)

const run = (changes) => p.evaluate(async (changes) => {
  const { apply } = await import("ruby_llm-reactionview")
  const file = "app/views/invoices/index.html.erb"
  const t = performance.now()
  const snapshot = await apply(changes.map((c) => ({ file, row: null, ...c })))
  const page = snapshot.templates.find((t) => t.file === file)
  return { ms: Math.round(performance.now() - t), summary: document.querySelector(".summary").textContent.trim(), states: page.states, rows: page.row_count ?? 0, shown: document.querySelectorAll("tbody tr.row").length }
}, changes)

const cases = [
  [{ name: "status", value: "overdue" }, { name: "query", value: "Pie" }],
  [{ name: "query", value: "" }],
  [{ name: "status", value: "all" }],
  [{ name: "sort", value: "due" }],
]
let ok = true
for (const changes of cases) {
  const r = await run(changes)
  // What the page shows once every refetch has landed.
  await p.waitForTimeout(1500)
  r.shown = await p.evaluate(() => document.querySelectorAll("tbody tr.row").length)
  const expected = Object.fromEntries(changes.map((c) => [c.name, c.value]))
  const stuck = Object.entries(expected).every(([k, v]) => r.states[k] === v)
  const match = r.rows === r.shown && stuck
  ok &&= match
  console.log(`${JSON.stringify(changes.map((c) => `${c.name}=${c.value}`))} → snapshot rows ${r.rows}, settled page rows ${r.shown}, ${r.ms} ms, "${r.summary}" ${JSON.stringify(r.states)} ${match ? "ok" : "MISMATCH"}`)
}
console.log(ok ? "pass" : "FAIL", "errors", errors)
await b.close()
