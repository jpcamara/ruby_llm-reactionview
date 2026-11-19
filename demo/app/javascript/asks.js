// Asks for the agent, kept in the document's "asks" Y.Map so everyone sees
// them: id -> JSON of { prompt, by, color, status, reply, at }. The agent answers
// the ones whose status is "asked".
export function bindAsks(doc, me) {
  const asks = doc.getMap("asks")
  const list = document.getElementById("asks")
  const form = document.getElementById("ask-form")
  const input = document.getElementById("ask-input")
  const invite = document.getElementById("invite")

  const render = () => {
    const items = [...asks.entries()].map(([id, json]) => [id, JSON.parse(json)]).sort(([, a], [, b]) => a.at - b.at).slice(-8)
    list.replaceChildren(...items.map(([, ask]) => {
      const li = document.createElement("li")
      li.className = `ask is-${ask.status}`
      const q = document.createElement("p")
      q.className = "ask-prompt"
      q.innerHTML = `<b style="color:${ask.color}"></b> `
      q.firstChild.textContent = ask.by
      q.append(ask.prompt)
      const a = document.createElement("p")
      a.className = "ask-reply"
      a.textContent = ask.reply || (ask.status === "working" ? "Working…" : "Waiting for the agent…")
      li.append(q, a)
      return li
    }))
    list.scrollTop = list.scrollHeight
  }

  const onSubmit = (event) => {
    event.preventDefault()
    const prompt = input.value.trim()
    if (!prompt) return
    asks.set(crypto.randomUUID(), JSON.stringify({ prompt, by: me.name, color: me.color, status: "asked", at: Date.now() }))
    input.value = ""
  }

  const onInvite = async () => {
    invite.disabled = true
    const token = document.querySelector("meta[name=csrf-token]")?.content
    await fetch(invite.dataset.url, { method: "POST", headers: { "X-CSRF-Token": token } })
    invite.textContent = "Agent invited"
  }

  asks.observe(render)
  form.addEventListener("submit", onSubmit)
  invite.addEventListener("click", onInvite)
  render()
  return () => {
    asks.unobserve(render)
    form.removeEventListener("submit", onSubmit)
    invite.removeEventListener("click", onInvite)
  }
}
