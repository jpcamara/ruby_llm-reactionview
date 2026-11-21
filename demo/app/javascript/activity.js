// Who changed the shared view last, in the document's "activity" Y.Map, so
// other people see a toast. The "view" map holds the states themselves.
import { toast } from "toast"
import { parseKey } from "ruby_llm-reactionview/yjs"

const ORIGIN = "activity"

export function bindActivity(doc) {
  const activity = doc.getMap("activity")
  const onActivity = (event, transaction) => {
    if (transaction.origin === ORIGIN || !activity.has("last")) return
    const last = JSON.parse(activity.get("last"))
    toast(`${last.by} set ${describe(last)}`, last.color)
  }
  activity.observe(onActivity)
  return {
    record: (me, change) => doc.transact(() => activity.set("last", JSON.stringify({ by: me.name, color: me.color, ...change, at: Date.now() })), ORIGIN),
    unbind: () => activity.unobserve(onActivity),
  }
}

function describe({ key, name, row, value }) {
  if (key) ({ name, row } = parseKey(key))
  const shown = value === "" ? "(empty)" : value
  return row ? `${name} = ${shown} on row ${row}` : `${name} = ${shown}`
}
