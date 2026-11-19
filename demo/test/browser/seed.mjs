// A fresh tab should open already in the shared view: no flash of defaults.
import { chromium } from "playwright"
const b = await chromium.launch(); const p = await b.newPage()
const seen = []
await p.exposeFunction("note", (s) => seen.push(s))
await p.addInitScript(() => document.addEventListener("DOMContentLoaded", () => window.note(document.querySelector(".summary")?.textContent.replace(/\s+/g, " ").trim())))
await p.goto("http://localhost:3311"); await p.waitForTimeout(1500)
console.log("first paint:", seen[0])
console.log("settled:   ", (await p.textContent(".summary")).replace(/\s+/g, " ").trim(), "| rows", await p.locator("tr.row").count())
await b.close()
