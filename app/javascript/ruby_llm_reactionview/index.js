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
        :host {
          --pa-accent: var(--page-agent-accent, #4f46e5);
          --pa-bg: var(--page-agent-background, Canvas); --pa-fg: var(--page-agent-color, CanvasText);
          --pa-line: color-mix(in srgb, var(--pa-fg) 12%, transparent); --pa-soft: color-mix(in srgb, var(--pa-fg) 5%, transparent);
          --pa-muted: color-mix(in srgb, var(--pa-fg) 55%, transparent);
          position: fixed; right: 16px; bottom: 16px; z-index: 1000; pointer-events: none;
          font: 14px/1.45 var(--page-agent-font, system-ui, -apple-system, sans-serif);
        }
        details { pointer-events: auto; margin-left: auto; background: var(--pa-bg); color: var(--pa-fg); border: 1px solid var(--pa-line);
                  border-radius: 14px; overflow: hidden; width: min(380px, calc(100vw - 32px));
                  box-shadow: 0 16px 40px rgb(0 0 0 / .14), 0 2px 8px rgb(0 0 0 / .06); }
        details:not([open]) { width: auto; border-radius: 999px; }
        summary { cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 10px 16px 10px 10px; font-weight: 600; list-style: none; user-select: none; }
        summary::-webkit-details-marker { display: none; }
        details[open] summary { border-bottom: 1px solid var(--pa-line); padding: 12px 14px; }
        .mark { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; flex: none; color: #fff; font-size: 13px;
                background: linear-gradient(135deg, color-mix(in srgb, var(--pa-accent) 70%, #fff), var(--pa-accent)); }
        .title { flex: 1; }
        .chevron { color: var(--pa-muted); transition: transform .2s; font-size: 16px; line-height: 1; }
        details:not([open]) .chevron { display: none; }
        details[open] .chevron { transform: rotate(180deg); }
        ol { list-style: none; margin: 0; padding: 14px; max-height: min(50vh, 420px); overflow: auto; display: flex; flex-direction: column; gap: 10px; }
        ol:empty { display: none; }
        .empty { margin: 0; padding: 16px 16px 4px; color: var(--pa-muted); font-size: 13px; }
        ol:not(:empty) + .empty { display: none; }
        li { white-space: pre-wrap; max-width: 85%; padding: 8px 12px; border-radius: 14px; overflow-wrap: anywhere; }
        li.you { align-self: flex-end; background: var(--pa-accent); color: #fff; border-bottom-right-radius: 4px; }
        li.agent { align-self: flex-start; background: var(--pa-soft); border: 1px solid var(--pa-line); border-bottom-left-radius: 4px; }
        li.agent[data-pending] { color: transparent; position: relative; min-width: 48px; min-height: 36px; }
        li.agent[data-pending]::after { content: ""; position: absolute; inset: 0; margin: auto; width: 6px; height: 6px; border-radius: 50%;
          background: var(--pa-muted); box-shadow: -10px 0 var(--pa-muted), 10px 0 var(--pa-muted); animation: pulse 1s infinite alternate; }
        @keyframes pulse { to { opacity: .3; } }
        form { display: flex; gap: 6px; padding: 12px 14px 14px; }
        input { flex: 1; min-width: 0; font: inherit; color: inherit; background: transparent; height: 38px; padding: 0 12px;
                border: 1px solid var(--pa-line); border-radius: 10px; }
        input:focus { outline: none; border-color: var(--pa-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pa-accent) 18%, transparent); }
        button { font: inherit; font-weight: 500; height: 38px; padding: 0 14px; border-radius: 10px; border: 0; background: var(--pa-accent); color: #fff; cursor: pointer; }
        button:hover { filter: brightness(.94); }
        button.reset { width: 38px; padding: 0; background: transparent; color: var(--pa-muted); border: 1px solid var(--pa-line); }
        button.reset:hover { color: var(--pa-fg); filter: none; }
      </style>
      <details part="panel"><summary part="title"><span class="mark" aria-hidden="true">✦</span><span class="title">${this.getAttribute("title") || "Ask this page"}</span><span class="chevron" aria-hidden="true">▾</span></summary>
        <ol part="messages"></ol>
        <p class="empty" part="empty">Ask in plain words. The agent changes what this page shows.</p>
        <form part="form"><input part="input" autocomplete="off" placeholder="${this.getAttribute("placeholder") || "What should the page show?"}"><button>Ask</button><button class="reset" type="button" title="New conversation" aria-label="New conversation">↺</button></form>
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
      onDelta: (text, id) => { const li = replyFor(id); delete li.dataset.pending; li.textContent = (li.dataset.streamed ? li.textContent : "") + text; li.dataset.streamed = "1" },
      onReply: (text, id) => {
        const li = replyFor(id)
        delete li.dataset.pending
        li.textContent = text
        li.dataset.done = "1"
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
      const li = replyFor(id)
      if (!li.dataset.streamed && !li.dataset.done) { li.textContent = "…"; li.dataset.pending = "" }
    })
    root.querySelector(".reset").addEventListener("click", () => { this.agent.reset(); list.replaceChildren(); replies.clear() })
    if (this.hasAttribute("open")) root.querySelector("details").open = true
  }

  disconnectedCallback() {
    this.agent?.disconnect()
    this.agent = null
  }
}

if (!customElements.get("page-agent")) customElements.define("page-agent", PageAgentElement)
