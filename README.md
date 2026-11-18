# ruby_llm-reactionview

RubyLLM tools built from a ReActionView template's `herb:state` declarations.
A model can change what a page shows, and only to values a person could set
by clicking the page's own controls.

```ruby
template = RubyLLM::ReActionView::Template.new("app/views/invoices/index.html.erb", root: Rails.root)
chat.with_tools(*template.tools(view))
```

For a template with `<%# herb:state (status: "all", sort: "due", query: "") %>`
and a keyed row state `(expanded: false)`, you get:

- `look_at_page`, which returns `view.look`
- `set_view(status:, sort:, query:)`, where every parameter is optional.
  `status` is an enum of the values in `data-herb-set="status=…"`, `sort` takes
  the `<option>`s of the select that sets `sort=$value`, and `query` is free
  text.
- `set_expanded(rows:, value:)`, for row states, by `herb:key`

The gem doesn't store state. The view is your object:

```ruby
class View
  def look = { states: ..., rows: ... }   # what the model sees
  def set(changes)                        # Array of RubyLLM::ReActionView::Change(name, row, value)
    ...                                   # session, URL, a Yjs map
  end
end
```

A value the page can't take raises `RubyLLM::ReActionView::InvalidValue`, and
the model gets the message back as the tool result so it can retry. Raise the
same error from `set` for a row that doesn't exist.

Requires Herb 0.11 and RubyLLM 2.x. Herb's state and slots features are
experimental.
