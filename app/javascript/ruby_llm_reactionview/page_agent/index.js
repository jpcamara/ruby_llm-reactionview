// The page agent in the browser. Importing this defines <page-agent>; use
// connectPageAgent to build your own UI instead.
//
//   channel.js  connectPageAgent, the connection to PageAgent::Channel
//   element.js  <page-agent>, the chat box (UI only)
import "ruby_llm_reactionview/page_agent/element"

export { connectPageAgent } from "ruby_llm_reactionview/page_agent/channel"
