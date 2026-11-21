// <page-agent>: a chat box for the page agent, connected through
// connectPageAgent in page_agent/channel.js. Put page_agent_tag in a view to use it.
import { connectPageAgent } from "ruby_llm_reactionview/page_agent/channel"

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
