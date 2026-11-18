// The page agent: an agent that works this tab's page through its Herb states.
//
// Put <page-agent></page-agent> on the page (page_agent_tag in a view) for a
// chat box, or call connectPageAgent for your own UI. The server builds the
// agent's tools from the templates this page rendered, and answers each tool
// call by asking the tab: "look" gets a snapshot, and "set" applies changes
// with setState, waits for the page to settle, and answers with a fresh one.
import { createConsumer } from "@rails/actioncable"
import { ready, templates, declarationsOf, instanceKey, setValue, scopeOf, textBetween, visibleText } from "ruby_llm_reactionview/page"

const ROWS = 40

let consumer
export function connectPageAgent({ onDelta = () => {}, onReply = () => {}, channel = "RubyLLM::ReActionView::PageAgentChannel" } = {}) {
  consumer ??= createConsumer()
  const subscription = consumer.subscriptions.create(channel, {
    received(message) {
      if (message.type === "delta") return onDelta(message.text, message.id)
      if (message.type === "reply") return onReply(message.text, message.id)
      const result = message.type === "set" ? apply(message.changes) : Promise.resolve(snapshot())
      result.catch((error) => ({ error: error.message }))
            .then((result) => subscription.perform("reply", { id: message.id, result }))
    },
  })

  return {
    async ask(prompt) {
      await ready()
      const id = crypto.randomUUID()
      const found = templates()
      if (!found.length) { onReply("This page has no states to work with.", id); return id }
      subscription.perform("ask", { id, prompt, snapshot: { templates: found.map(({ file, version, repeated }) => ({ file, version, repeated })) } })
      return id
    },
    reset: () => subscription.perform("reset"),
    disconnect: () => subscription.unsubscribe(),
  }
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

  const settled = settle()
  for (const change of changes) setValue(change, change.value)
  await settled
  return snapshot()
}

// Resolves once the server's re-render has landed, or soon if there is none.
function settle() {
  return new Promise((resolve) => {
    let timer = setTimeout(done, 300)
    function done() { document.removeEventListener("herb:slot-update", onUpdate); resolve() }
    function onUpdate() { clearTimeout(timer); timer = setTimeout(done, 100) }
    document.addEventListener("herb:slot-update", onUpdate)
  })
}

// <page-agent>: a small chat box for the page agent.
class PageAgentElement extends HTMLElement {
  connectedCallback() {
    if (this.agent) return
    const root = this.attachShadow({ mode: "open" })
    root.innerHTML = `
      <style>
        :host { position: fixed; right: 16px; bottom: 16px; z-index: 1000; font: 14px system-ui, sans-serif; pointer-events: none; }
        details { pointer-events: auto; margin-left: auto; background: Canvas; color: CanvasText; border: 1px solid #8884; border-radius: 10px; box-shadow: 0 6px 24px #0002; width: min(360px, calc(100vw - 32px)); }
        details:not([open]) { width: auto; }
        summary { cursor: pointer; padding: 10px 14px; font-weight: 600; list-style: none; }
        ol { list-style: none; margin: 0; padding: 0 14px; max-height: 50vh; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
        li { white-space: pre-wrap; } li.you { font-weight: 600; } li.agent { opacity: .9; }
        form { display: flex; gap: 6px; padding: 10px 14px 14px; }
        input { flex: 1; font: inherit; padding: 6px 8px; border: 1px solid #8886; border-radius: 6px; }
        button { font: inherit; padding: 6px 10px; border-radius: 6px; border: 0; background: #4f46e5; color: #fff; cursor: pointer; }
        button.reset { background: transparent; color: inherit; border: 1px solid #8886; }
      </style>
      <details part="panel"><summary part="title">${this.getAttribute("title") || "Ask this page"}</summary>
        <ol part="messages"></ol>
        <form part="form"><input part="input" autocomplete="off" placeholder="${this.getAttribute("placeholder") || "What should the page show?"}"><button>Ask</button><button class="reset" type="button" title="New conversation">↺</button></form>
      </details>`
    const list = root.querySelector("ol")
    const input = root.querySelector("input")
    const replies = new Map()
    const add = (text, who) => {
      const li = document.createElement("li")
      li.className = who
      li.textContent = text
      list.append(li)
      list.scrollTop = list.scrollHeight
      return li
    }
    const replyFor = (id) => replies.get(id) ?? replies.set(id, add("", "agent")).get(id)
    this.agent = connectPageAgent({
      onDelta: (text, id) => { const li = replyFor(id); li.textContent = (li.dataset.streamed ? li.textContent : "") + text; li.dataset.streamed = "1" },
      onReply: (text, id) => {
        const li = replyFor(id)
        li.textContent = text
        replies.delete(id)
        this.dispatchEvent(new CustomEvent("page-agent:reply", { detail: { text, id }, bubbles: true }))
      },
    })
    root.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault()
      const prompt = input.value.trim()
      if (!prompt) return
      input.value = ""
      add(prompt, "you")
      const id = await this.agent.ask(prompt)
      replyFor(id).textContent = "…"
    })
    root.querySelector(".reset").addEventListener("click", () => { this.agent.reset(); list.replaceChildren() })
    if (this.hasAttribute("open")) root.querySelector("details").open = true
  }

  disconnectedCallback() {
    this.agent?.disconnect()
    this.agent = null
  }
}

if (!customElements.get("page-agent")) customElements.define("page-agent", PageAgentElement)
