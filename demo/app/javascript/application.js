import "reactionview"
import "yrby-client/element"
import "ruby_llm-reactionview/page-agent"
import { bindHerbStates } from "ruby_llm-reactionview/yjs"
import { bindPeople } from "people"
import { bindAsks } from "asks"
import { bindActivity } from "activity"

document.addEventListener("yrby:synced", ({ target, detail }) => {
  if (!target.dataset.sharedView) return

  const me = whoAmI()
  detail.lease.setPresence({ user: me })

  // Two templates on this page have states, so keys name their file.
  const activity = bindActivity(detail.doc)
  const unbind = [
    bindHerbStates(detail.doc.getMap("view"), {
      states: target.dataset.sharedView.split(" "),
      qualified: true,
      onChange: (change, { local }) => local && activity.record(me, change),
    }),
    activity.unbind,
    bindPeople(detail.provider.awareness),
    bindAsks(detail.doc, me),
  ]
  detail.signal.addEventListener("abort", () => unbind.forEach((fn) => fn()), { once: true })
})

const NAMES = ["Ada", "Grace", "Linus", "Margaret", "Ken", "Barbara", "Dennis", "Radia"]
const COLORS = ["#e76f51", "#2a9d8f", "#e9c46a", "#457b9d", "#f4a261", "#8ab17d", "#d62828", "#6d597a"]

// A name and color per tab, so two windows side by side are two people.
function whoAmI() {
  try {
    const saved = sessionStorage.getItem("me")
    if (saved) return JSON.parse(saved)
  } catch {}
  const i = Math.floor(Math.random() * NAMES.length)
  const me = { name: NAMES[i], color: COLORS[i] }
  try { sessionStorage.setItem("me", JSON.stringify(me)) } catch {}
  return me
}

