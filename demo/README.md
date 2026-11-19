# Demo

A Rails app with ReActionView (`herb:state`) pages, agents from this gem (loaded from `..`), and shared state from yrby.

- `/` is the invoices page. Its view (status, sort, query, open rows, totals breakdown) is
  shared through a yrby document, so every tab sees the same thing.
  - "Invite the agent" adds `ViewAgent` (`app/agents/`), which joins the document and answers
    shared asks.
  - "Ask about just this tab" is the gem's `<page-agent>`. It drives the tab it is in.
  - `InvoicesController` seeds the shared view on the server, so the first paint is already
    shared.
- `/customers` renders `_card` once per row with a `pinned` state. Its `<page-agent>` pins
  cards by row.

## Run

```sh
bin/rails db:prepare                       # creates and seeds the SQLite database
set -a; source ~/.config/yrby/fireworks.env; set +a
bin/rails s -p 3311
```

The model is set in `config/initializers/ruby_llm_reactionview.rb` (Fireworks through RubyLLM's
OpenAI provider).

## Browser tests

Plain Playwright scripts. Run them against the server on port 3311:

```sh
cd test/browser && npm install
node two.mjs     # two tabs stay in sync
node seed.mjs    # first paint is the shared view
node tab.mjs     # <page-agent>: streaming, history, the other tab follows
node agent.mjs   # the yrby ViewAgent
node cards.mjs   # pinning per-row partials
node demo.mjs    # records the two-tab demo video into demo-rec/
```
