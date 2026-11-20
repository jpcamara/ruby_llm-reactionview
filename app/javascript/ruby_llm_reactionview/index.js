// ruby_llm-reactionview in the browser.
//
//   page.js      Herb state access (no agent code)
//   text.js      visible text
//   snapshot.js  what an agent can see and change
//   channel.js   connectPageAgent, the connection to the server
//   element.js   <page-agent>, the chat box
//
// Importing this module defines <page-agent>. Use connectPageAgent to build
// your own UI instead.
import "ruby_llm_reactionview/element"

export { connectPageAgent } from "ruby_llm_reactionview/channel"
export { report, snapshot, apply } from "ruby_llm_reactionview/snapshot"
