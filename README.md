# ruby_llm-reactionview

RubyLLM tools built from a ReActionView page's `herb:state` declarations. A
model can change what a page shows, and only to values a person could set by
clicking the page's own controls.

There are two ways to use it. With the page agent, the browser tab holds the
states and you write no code. With a View, the server holds the states in a
session, a cache, or a shared yrby document.

## The page agent

```sh
bundle add ruby_llm-reactionview
bin/rails generate ruby_llm_reactionview:install
```

Then put `<%= page_agent_tag %>` in a layout or view. Every ReActionView page
it appears on gets a chat box whose agent can read the page and set its
states.

- When someone asks, the tab reports which templates it rendered (the page
  itself and any partials with state) and their compiled versions. The server
  builds the tools from those files on disk, so a tab can't widen what the
  model may set. Files outside `app/views` and stale versions are refused.
- `look_at_page` returns each template's states, its keyed rows (or each
  rendering, for a partial rendered once per row) with their states and
  visible text, and the page's visible text.
- Setting a state calls Herb's `setState` in the tab. States the server reads
  refetch as usual, so your controller filters the way it does for clicks.
  The tab answers once the re-render lands.
- Replies stream, and a conversation lasts as long as the tab's subscription.
- `page_agent_tag` takes `title:`, `placeholder:` and `open: true`. Theme it
  with CSS variables on the element:

  ```css
  page-agent {
    --page-agent-accent: #4f46e5;
    --page-agent-font: Inter, system-ui, sans-serif;
    --page-agent-background: #fff;
    --page-agent-color: #0f172a;
  }
  ```

  Move it with `top`, `right`, `bottom` and `left`. It sits fixed in the bottom-right corner by default.

Configure it in `config/initializers/ruby_llm_reactionview.rb`:

```ruby
RubyLLM::ReActionView.configure do |config|
  config.chat = -> { RubyLLM.chat(model: "gpt-5-mini") }
  config.authorize = -> { current_user.present? } # runs in the channel
end
```

Without `authorize`, the agent is allowed everywhere except production.

Use `connectPageAgent({ onDelta, onReply })` from `"ruby_llm-reactionview"`
to build your own UI instead of `<page-agent>`. Position the element with
page CSS, such as `page-agent { left: 16px; right: auto; }`.

The channel keeps the conversation on its instance, so it needs Action
Cable. AnyCable builds a channel instance per command.

## Tools

For one template you get:

- `look_at_page`
- `set_view(...)`, with one optional parameter per page state. A string state
  is an enum of the values in `data-herb-set="status=…"` and of the
  `<option>`s of a select that sets `sort=$value`. A string set from a text
  field takes any text.
- `set_<row state>(rows:, value:)` for states inside a `herb:key` loop.

With several stateful templates, each tool is prefixed with the template:
`set_invoices_view`, `set_totals_view`, `set_invoices_expanded`. A partial
rendered once per row gets one tool, `set_card(rows:, pinned:)`, keyed by the
row's `herb:key`.

A value the page can't take raises `RubyLLM::ReActionView::InvalidValue`, and
the model gets the message back as the tool result so it can retry.

## Views and stores

When the states live on the server, use a View with a store:

```ruby
page = RubyLLM::ReActionView::Page.for(%w[app/views/invoices/index.html.erb app/views/invoices/_totals.html.erb], root: Rails.root)
store = RubyLLM::ReActionView::Stores::Hash.new(session[:herb_states] ||= {})
view = RubyLLM::ReActionView::View.new(page, store:) do |templates|
  { invoices: Invoice.limit(40).as_json } # anything else the model should see
end
chat.with_tools(*view.tools)
```

- `look` returns each state's value from the store, or the template default
  when the store has none, the row states the store holds, and whatever the
  block returns.
- Subclass View to refuse changes (`check(changes)`, raising InvalidValue)
  or react to them (`changed(change)`).
- `Stores::Hash` wraps any Hash-like object. `Stores::YMap` wraps a yrby
  `Y::Map`, or a block returning one, with an optional `edit:` for writes
  that must be recorded, such as `edit: method(:edit)` in a `Y::Agent`.

Keys are `status`, `expanded@29`, and `file#name` on pages with several
stateful templates. The browser binding uses the same keys:

```js
import { bindHerbStates } from "ruby_llm-reactionview/yjs"
const unbind = bindHerbStates(doc.getMap("view"), { qualified: true, onChange: (change, { local }) => {} })
```

Everyone on the page, and any server-side agent writing the map, then sees
the same view.

## Seeding

So a page renders with the states the server has, not the template defaults:

```ruby
class InvoicesController < ApplicationController
  include RubyLLM::ReActionView::Seeding
  seed_herb_states { InvoicesView.new(page, store:).seeds }
end
```

`View#seeds` returns Herb's override shape, `{ file => { name => value } }`.
`herb_state` in the controller reads the seeded values, and the page paints
in that state with no flash. When the tab refetches, the states it sends
win. Seeding fills ReActionView's `@__herb_state_overrides`, an internal of
0.6, so check it when upgrading.

## Known limits

- Herb refetches only when a state the server reads is live on the page. If
  your controller filters by a state the template reads only inside a
  branch that isn't showing, such as `<% if query != "" %>`, changing that
  state doesn't refetch. Read it somewhere always rendered, such as
  `data-query="<%= query.strip %>"`.
- Herb sends only page-level states to the server, so row states can't
  affect server-rendered branches, and seeding covers page states only.

Requires Herb 0.11, ReActionView 0.6 and RubyLLM 2.x. Herb's state and slots
features are experimental.
