// Connects this tab to the server's PageAgent::Channel. The server runs the
// model and its tools; each tool call comes back here as "look" or "set" and
// is answered from snapshot.js. Reply text streams to onDelta and onReply.
//
//   const agent = connectPageAgent({ onDelta, onReply })
//   const id = await agent.ask("Show overdue invoices")
import { createConsumer } from "@rails/actioncable"
import { ready } from "ruby_llm_reactionview/page"
import { report, snapshot, apply } from "ruby_llm_reactionview/snapshot"

let consumer
export function connectPageAgent({ onDelta = () => {}, onReply = () => {}, channel = "RubyLLM::ReActionView::PageAgent::Channel" } = {}) {
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
      const rendered = report()
      if (!rendered.templates.length) { onReply("This page has no states to work with.", id); return id }
      subscription.perform("ask", { id, prompt, snapshot: rendered })
      return id
    },
    reset: () => subscription.perform("reset"),
    disconnect: () => subscription.unsubscribe(),
  }
}
