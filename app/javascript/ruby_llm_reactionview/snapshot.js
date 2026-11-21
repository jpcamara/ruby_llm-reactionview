// What an agent can see and change on this page. Every tool call the server
// makes ends up here:
//
//   report()    which stateful templates the page rendered, sent with each ask
//               so the server can build tools from those files on disk
//   snapshot()  the current states, keyed rows and visible text ("look")
//   apply()     sets states, waits for the re-render (including a server
//               refetch), and returns a snapshot ("set")
import { templates, declarationsOf, instanceKey, setValue, scopeOf } from "ruby_llm_reactionview/page"
import { textBetween, visibleText } from "ruby_llm_reactionview/text"

const ROWS = 40
const REFETCH_TIMEOUT = 8000 // under the server's default 10 s wait for an answer

export function report() {
  return { templates: templates().map(({ file, version, repeated }) => ({ file, version, repeated })) }
}

// What the page shows: each stateful template's states and rows, and the
// page's visible text. Mirrors what the tools address.
export function snapshot() {
  const { slots, state } = window.HerbRuntime
  const valueAt = (name, region, item) => state.getState(name, { scope: { region, item } })

  const found = templates().map((template) => {
    const declarations = declarationsOf(template.regions[0])
    const pageStates = declarations.filter((d) => d.scope === "region")
    if (template.repeated) {
      const rows = template.regions.map((region) => ({
        key: instanceKey(region),
        states: Object.fromEntries(pageStates.map((d) => [d.name, valueAt(d.name, region, null)])),
        text: textBetween(region.ranges[0].start, region.ranges[0].end, 300),
      }))
      return { file: template.file, repeated: true, rows: rows.slice(0, ROWS), row_count: rows.length }
    }

    const region = template.regions[0]
    const rows = []
    for (const collection of new Set(declarations.filter((d) => d.scope !== "region").map((d) => d.scope))) {
      for (const [key, item] of slots.itemsFor(region.file, collection, region.occurrence)) {
        rows.push({
          key,
          states: Object.fromEntries(declarations.filter((d) => d.scope === collection).map((d) => [d.name, valueAt(d.name, region, item)])),
          text: textBetween(item.start, item.end, 300),
        })
      }
    }
    const entry = { file: template.file, states: Object.fromEntries(pageStates.map((d) => [d.name, valueAt(d.name, region, null)])) }
    if (rows.length) Object.assign(entry, { rows: rows.slice(0, ROWS), row_count: rows.length })
    return entry
  })
  return { templates: found, text: visibleText(document.body) }
}

export async function apply(changes) {
  const missing = changes.find((change) => !scopeOf(change))
  if (missing) return { error: missing.row == null ? `${missing.name} isn't on the page` : `row ${missing.row} isn't on the page` }

  const rendered = slotUpdate()
  for (const change of changes) setValue(change, change.value)
  await (refetched() ?? rendered)
  return snapshot()
}

// When a change makes Herb refetch from the server (the state is one the
// server reads), its refetcher has a pending timer right after setState.
// Asking it for the same refetch joins that pending one,
// and resolves once the new HTML is applied. A refetch superseded by a later
// change comes back stale, so wait for the next. Returns null when no refetch
// is pending, or when the runtime doesn't look like ReActionView 0.6's.
function refetched() {
  const { state } = window.HerbRuntime
  const refetch = state.refetch
  if (!refetch || !("timer" in refetch) || typeof refetch.request !== "function" || refetch.timer === null) return null

  const wait = async () => {
    // A stale result means a later refetch replaced ours; ask again to wait
    // for that one (or, if it's already running, for one more).
    for (let tries = 0; tries < 5; tries++) {
      const result = await refetch.request(state.options?.refetchDebounce ?? 0)
      if (!result?.stale) return
    }
  }
  return Promise.race([wait(), new Promise((resolve) => setTimeout(resolve, REFETCH_TIMEOUT))])
}

// Resolves after the client-side re-render, or soon if there is none.
function slotUpdate() {
  return new Promise((resolve) => {
    let timer = setTimeout(done, 300)
    function done() { document.removeEventListener("herb:slot-update", onUpdate); resolve() }
    function onUpdate() { clearTimeout(timer); timer = setTimeout(done, 100) }
    document.addEventListener("herb:slot-update", onUpdate)
  })
}
