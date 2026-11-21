# ruby_llm-reactionview

Lets an LLM change what a ReActionView page shows. It builds
[RubyLLM](https://rubyllm.com) tools from the page's own `herb:state`
declarations, so a model can set only the values a person could set by
clicking the page's controls.

**For RubyLLM users:** [ReActionView](https://reactionview.dev) renders ERB
templates that declare UI state, like `<%# herb:state (status: "all") %>`.
Buttons and selects change that state with attributes such as
`data-herb-set="status=open"`, and the page re-renders without custom
JavaScript. This gem reads those declarations and controls and turns them into
tools you pass to `chat.with_tools`.

**For ReActionView users:** your templates already describe what can change
and to which values. This gem turns that into tools a model can call, and
sets the states the same way a click would.

## From template to tools

```erb
<%# herb:state (status: "all", sort: "due", query: "") %>
<button data-herb-set="status=all">All</button>
<button data-herb-set="status=open">Open</button>
<button data-herb-set="status=paid">Paid</button>
<select data-herb-set="sort=$value">
  <option value="due">Due</option>
  <option value="amount">Amount</option>
</select>
<input value="<%= query %>" data-herb-set="query=$value">

<% invoices.each do |invoice| %>
  <%# herb:key invoice.id %>
  <%# herb:state (expanded: false) %>
  <tr data-herb-toggle="expanded">...</tr>
<% end %>
```

becomes three tools:

| Tool | Parameters |
|---|---|
| `look_at_page` | none |
| `set_view` | `status`: one of `all`, `open`, `paid`; `sort`: one of `due`, `amount`; `query`: any string. All optional. |
| `set_expanded` | `rows`: herb:keys; `value`: boolean |

With several stateful templates on a page, each tool is prefixed with its
template: `set_invoices_view`, `set_totals_view`, `set_invoices_expanded`. A
partial rendered once per row gets one tool, such as `set_card(rows:,
pinned:)`, keyed by each row's `herb:key`.

A value the page can't take raises `RubyLLM::ReActionView::InvalidValue`. The
model gets the message as the tool result and can try again.

## Writing templates for an agent

- **Allowed values come from literal controls.** `data-herb-set="status=open"`
  adds `open` to the enum. A value written with ERB, such as
  `data-herb-set="status=<%= value %>"` in a loop, can't be read from the
  template, so write each control out.
- **Selects list their options.** `<select data-herb-set="sort=$value">`
  turns its `<option value>`s into the enum. A text field set with `$value`
  takes any string.
- **Read server-side states where they always render.** Herb refetches only
  when a state the server reads is on the page. If the template reads `query`
  only inside `<% if query != "" %>`, clearing it never refetches. Read it
  somewhere always rendered, such as `data-query="<%= query.strip %>"`.
- **Key your rows.** Row states need a `herb:key` so a tool can name the row.

## Where the states live

The tools work on a *view*, an object with `look` (what the page shows, for
the model) and `set(changes)`. The gem has two.

### On the server: View and a store

```ruby
page = RubyLLM::ReActionView::Page.for(%w[app/views/invoices/index.html.erb app/views/invoices/_totals.html.erb], root: Rails.root)
store = RubyLLM::ReActionView::Stores::Hash.new(session[:herb_states] ||= {})
view = RubyLLM::ReActionView::View.new(page, store:) do |templates|
  { invoices: Invoice.limit(40).as_json } # anything else the model should see
end

chat = RubyLLM.chat.with_tools(*view.tools)
chat.ask("Show overdue invoices, biggest first")
```

- `look` returns each state's value from the store (or the template default),
  the row states the store holds, and whatever the block returns.
- Subclass View to refuse changes (`check(changes)`, raising `InvalidValue`)
  or react to them (`changed(change)`).
- `Stores::Hash` wraps any Hash-like object. A store is anything that answers
  `read(key)`, `write(key, value)` and `keys`. Keys are `status`,
  `expanded@29`, and `file#name` on pages with several stateful templates.
- `Stores::YMap` wraps a yrby `Y::Map`, or a block returning one, with an
  optional `edit:` for writes that must be recorded, such as
  `edit: method(:edit)` in a `Y::Agent`. See Yjs below.

### In the browser tab: TabView

When the tab holds the states, `TabView` sends each tool call to the tab and
returns its answer. You supply the transport.

```ruby
# The tab's report, from report() below:
# { "templates" => [{ "file" => "app/views/invoices/index.html.erb", "version" => "...", "repeated" => false }] }
view = RubyLLM::ReActionView::TabView.for(report, root: Rails.root) do |message|
  send_to_tab_and_wait(message) # { "type" => "look" } or { "type" => "set", "changes" => [...] }
end
chat.with_tools(*view.tools)
```

`PageAgent` below is a complete transport over Action Cable, and a worked
example of this.

The tab only names its templates. The tools are built from those files on
disk, so a tab can't widen what the model may set. Files outside `app/views`,
more than 20 templates, and stale versions are refused.

In the browser, import the answers:

```js
import { report, snapshot, apply } from "ruby_llm-reactionview"

report()          // the templates to send with a question
snapshot()        // answer to "look": states, keyed rows, visible text
await apply(changes) // answer to "set": sets the states, waits for the re-render, returns a snapshot
```

| Module | What it does |
|---|---|
| `page.js` | Reads and sets Herb states through `window.HerbRuntime`. No agent code. |
| `text.js` | The text a person can see. |
| `snapshot.js` | `report()`, `snapshot()` and `apply()`. |

## The page agent

A ready-made agent built on TabView: a chat box in the tab and an Action Cable
channel that runs the model. It's optional. Nothing in the core loads its
JavaScript unless you import it.

```sh
bin/rails generate ruby_llm_reactionview:page_agent
```

This writes `config/initializers/ruby_llm_reactionview_page_agent.rb`, imports
`ruby_llm-reactionview/page-agent` in `application.js`, and pins
`@rails/actioncable` if it's missing. Then put `<%= page_agent_tag %>` in a
layout or view.

```ruby
RubyLLM::ReActionView::PageAgent.configure do |config|
  config.chat = -> { RubyLLM.chat(model: "gpt-5-mini") }
  config.instructions = "..."                       # the system prompt; the default asks for short, plain replies
  config.authorize = -> { current_user.present? }   # runs in the channel
end
```

- Without `authorize`, the agent is allowed everywhere except production.
- Each question carries the tab's `report()`. The channel builds a TabView
  from it and sends tool calls back to the tab. Replies stream, and the
  conversation lasts as long as the tab's subscription.
- The tools are replaced on each question, because the page may have
  changed, with `chat.with_tools(nil).with_tools(*view.tools)`. That also
  clears any tools `config.chat` adds.
- `page_agent_tag` takes `title:`, `placeholder:` and `open: true`. Theme the
  element with CSS variables, and move it with `top`, `right`, `bottom` and
  `left` (it sits in the bottom-right corner by default):

  ```css
  page-agent {
    --page-agent-accent: #4f46e5;
    --page-agent-font: Inter, system-ui, sans-serif;
    --page-agent-background: #fff;
    --page-agent-color: #0f172a;
  }
  ```

- For your own UI, use `connectPageAgent({ onDelta, onReply })` from
  `"ruby_llm-reactionview/page-agent"`.

| File | What it does |
|---|---|
| `page_agent.rb` | `PageAgent.configure` and its settings. |
| `page_agent/channel.rb` | `PageAgent::Channel`: builds the TabView, runs the chat in a thread, streams the reply. |
| `page_agent/channel.js` | `connectPageAgent`: sends questions, answers tool calls with `snapshot()` and `apply()`. |
| `page_agent/element.js` | `<page-agent>`, the chat box. UI only. |

## Yjs

To share a page's states through a yrby document, so every tab and any
server-side agent see the same view, bind them to a `Y.Map` in the browser
and give server-side Views a `Stores::YMap` over the same map:

```js
import { bindHerbStates } from "ruby_llm-reactionview/yjs"
const unbind = bindHerbStates(doc.getMap("view"), { qualified: true, onChange: (change, { local }) => {} })
```

The binding uses the same keys as the server, writes with the `"herb"`
origin and skips its own writes, and re-applies values after each slot
update. It also applies the map's values when it starts, so row states that
seeding can't cover come back after a full page load, just after the first
paint.

## Seeding

So a page renders with the states the server holds, not the template
defaults:

```ruby
class InvoicesController < ApplicationController
  include RubyLLM::ReActionView::Seeding
  seed_herb_states { InvoicesView.new(page, store:).seeds }
end
```

`View#seeds` returns Herb's override shape, `{ file => { name => value } }`.
`herb_state` in the controller reads the seeded values, and the page paints in
that state with no flash. When the tab refetches, the states it sends win.
Seeding fills ReActionView's `@__herb_state_overrides`, an internal of 0.6,
and logs a warning if it's gone.

## What it depends on

ReActionView's state and slots features are experimental, and most of what
this gem uses from Herb isn't documented yet. Check these when upgrading.

**Herb and ReActionView**

| Used | Where | Status |
|---|---|---|
| `Herb::Engine::Slots::Manifest::Collector`, compiled template manifests (states, defaults, scopes, version) | `template.rb` | Not documented |
| `Herb::Visitor` over the parsed template | `controls.rb` | Herb's Ruby API |
| `@__herb_state_overrides` (filled by Seeding) | `seeding.rb` | Internal to ReActionView 0.6 |
| `window.HerbRuntime.state`: `manifestFor`, `getState`, `setState` with a `{ region, item }` scope | `page.js`, `snapshot.js` | Not documented (the documented API is `useState(this)` for Stimulus) |
| `window.HerbRuntime.slots`: `regions`, `itemsFor`, and a region's `file`, `version`, `occurrence`, `item`, `ranges` | `page.js`, `snapshot.js` | Not documented |
| The `herb:slot-update` event | `snapshot.js`, `y_binding.js` | Not documented |
| The `herb:state-change` event (`name`, `value`, `file`, `occurrence`, `key`) | `y_binding.js` | Not documented |
| `HerbRuntime.state.refetch` (`timer`, `request`) and `state.options.refetchDebounce`, to wait for a server refetch | `snapshot.js` | Internal; `apply()` falls back without it |

**RubyLLM**

| Used | Where |
|---|---|
| `RubyLLM::Tool` subclasses built per template with `Class.new`, each declaring a JSON schema with `parameters(...)` | `tools.rb` |
| `Tool#call` is wrapped to turn `ArgumentError` and `TypeError`, including RubyLLM's own argument errors, into an `{ error: }` result the model can act on | `tools.rb` |
| `chat.with_tools(nil).with_tools(*new)` to replace a chat's tools, as RubyLLM documents | `page_agent/channel.rb` |
| `chat.ask(prompt) { \|chunk\| ... }` to stream, and `with_instructions` | `page_agent/channel.rb` |

## Known limits

- **Row states start at their template default.** Herb sends only page-level
  states to the server, so seeding covers page states only, and a row state
  such as `expanded` can't change what the server renders. A row the agent
  opened is closed again after a full page load, unless something in the
  browser re-applies it.
- **Seeding uses a ReActionView 0.6 internal.** It fills
  `@__herb_state_overrides`. If an upgrade removes it, pages render with the
  template defaults and Seeding logs a warning once.
- **`apply()` reads Herb's refetcher directly** to wait for a server refetch
  to land before answering. On a runtime without it, `apply()` falls back to
  waiting for `herb:slot-update` or 300 ms, and the model may see rows from
  before a slow refetch.
- **The page agent needs Action Cable.** The conversation lives on the
  channel instance, and AnyCable builds one per command.
- **The page agent has no hook for your own tools.** Tools from `config.chat`
  are cleared on each question along with the page's old ones.

Requires Herb 0.11, ReActionView 0.6 and RubyLLM 2.x.
