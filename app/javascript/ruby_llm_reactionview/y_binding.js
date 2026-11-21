// Shares a page's Herb states through a Y.Map, so everyone on the page (and a
// server-side agent writing the same map) sees the same view.
//
//   import { bindHerbStates } from "ruby_llm-reactionview/yjs"
//   const unbind = bindHerbStates(doc.getMap("view"), { states: ["status", "sort"] })
//
// Keys match RubyLLM::ReActionView::Address: "status", "expanded@29", and
// "file#name" when `qualified` (pages with several stateful templates).
// onChange(change, { local }) fires for every change, local or remote.
import { ready, setValue, getValue, changeOf } from "ruby_llm_reactionview/page"

const ORIGIN = "herb"

export function keyOf({ file, name, row }, qualified = false) {
  const base = row === null || row === undefined ? name : `${name}@${row}`
  return qualified ? `${file}#${base}` : base
}

export function parseKey(key) {
  const [file, base] = key.includes("#") ? key.split("#", 2) : [null, key]
  const [name, row] = base.split("@", 2)
  return { file, name, row: row ?? null }
}

export function bindHerbStates(map, { states = null, qualified = false, onChange = () => {} } = {}) {
  let applying = false
  let stopped = false
  const shared = (name) => !states || states.includes(name)

  const write = (key, value) => {
    const change = parseKey(key)
    if (!shared(change.name) || getValue(change) === undefined || getValue(change) === value) return false
    applying = true
    try { return setValue(change, value) } finally { applying = false }
  }
  const writeAll = () => map.forEach((value, key) => write(key, value))

  const onState = ({ detail }) => {
    if (applying || !shared(detail.name)) return
    const change = changeOf(detail)
    const key = keyOf(change, qualified)
    if (map.get(key) === detail.value) return
    map.doc.transact(() => map.set(key, detail.value), ORIGIN)
    onChange({ ...change, value: detail.value }, { local: true })
  }

  const onMap = (event, transaction) => {
    if (transaction.origin === ORIGIN) return
    for (const key of event.keysChanged) {
      if (!map.has(key)) continue
      write(key, map.get(key))
      onChange({ ...parseKey(key), value: map.get(key) }, { local: false })
    }
  }

  // Rows the server just rendered pick up their shared values.
  let pending = false
  const onSlots = () => {
    if (pending) return
    pending = true
    queueMicrotask(() => { pending = false; writeAll() })
  }

  ready().then(() => {
    if (stopped) return
    document.addEventListener("herb:state-change", onState)
    document.addEventListener("herb:slot-update", onSlots)
    map.observe(onMap)
    writeAll()
  })

  return () => {
    stopped = true
    document.removeEventListener("herb:state-change", onState)
    document.removeEventListener("herb:slot-update", onSlots)
    map.unobserve(onMap)
  }
}
