// The page agent in the browser. Importing this defines <page-agent>.
// connectPageAgent connects a custom UI to the same channel.
//
//   channel.js  connectPageAgent, the connection to PageAgent::Channel
//   element.js  <page-agent>, the chat box
import "ruby_llm_reactionview/page_agent/element"

export { connectPageAgent } from "ruby_llm_reactionview/page_agent/channel"
