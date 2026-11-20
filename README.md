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
| The `herb:slot-update` event | `snapshot.js` | Not documented |

**RubyLLM**

| Used | Where |
|---|---|
| `RubyLLM::Tool` subclasses built per template with `Class.new`, each declaring a JSON schema with `parameters(...)` | `tools.rb` |
| `Tool#call` is wrapped to turn `ArgumentError` and `TypeError`, including RubyLLM's own argument errors, into an `{ error: }` result the model can act on | `tools.rb` |
| `chat.with_tools(nil).with_tools(*new)` to replace a chat's tools, as RubyLLM documents | apps using `TabView` per request |

## Known limits

- Herb sends only page-level states to the server, so row states can't affect
  server-rendered branches, and seeding covers page states only.
- `apply()` waits for `herb:slot-update`, or 300 ms if none comes. A slow
  refetch can land after it answers, so the model may see the previous rows.

Requires Herb 0.11, ReActionView 0.6 and RubyLLM 2.x.
