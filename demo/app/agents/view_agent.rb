require "json"
require "y/agent"

# An agent that works the invoices page by changing its Herb states.
#
# Its tools come from the page's templates, through ruby_llm-reactionview:
# one tool per stateful template, typed and limited to the values the page's
# controls can set, and a tool per row state. They write the shared
# document's "view" map, which every open page applies with setState, so
# people watch their own filters, sort and rows change.
class ViewAgent < Y::Agent
  PACE = 0.6 # seconds between state changes, so people can follow them
  COLOR = "#7c3aed"

  model ENV.fetch("AGENT_MODEL", "accounts/fireworks/routers/glm-5p3-fast"), provider: :openai, assume_model_exists: true
  thinking effort: :low
  instructions <<~TEXT
    You help a team work an invoices page that they are all looking at
    together. You can't write HTML or answer from memory. You change what the
    page shows through its states, with your tools, and everyone sees each
    change happen. Look at the page first. Change only what the ask needs.
    When you're done, reply in one or two short sentences of plain text,
    with no Markdown.
  TEXT

  # The page's view in the document, with the invoices that match it.
  class View < InvoicesView
    def initialize(agent)
      @agent = agent
      store = RubyLLM::ReActionView::Stores::YMap.new(edit: agent.method(:edit)) { agent.view_map }
      super(InvoicesView.page, store:)
    end

    def look_description
      "What the page shows now: each template's states, how many invoices match, the first 40 " \
        "invoices (row keys are invoice ids, with their expanded state), and who is on the page."
    end

    def look
      result = super
      states = result.dig("templates", INDEX)
      invoices = Invoice.view(**states["states"].symbolize_keys.slice(:status, :sort, :query))
      open = states["rows"] || {}
      result.merge(
        "today" => Date.current.iso8601, "count" => invoices.count,
        "invoices" => invoices.limit(40).map do |invoice|
          { id: invoice.id, number: invoice.number, customer: invoice.customer, status: invoice.status,
            due: invoice.due_on.iso8601, amount: invoice.amount, expanded: open.dig(invoice.id.to_s, "expanded") || false }
        end,
        "people" => @agent.people.values.filter_map { |state| state.dig("user", "name") }
      )
    end

    def changed(change)
      @agent.record(key(change), change.value)
      sleep PACE
    end
  end

  def initialize(document, **)
    super
    @view = View.new(self)
    self.presence = presence_for("here")
  end

  def joined = answer_asks
  def changed(_blocks) = answer_asks
  def document_tools = @view.tools

  def view_map = doc.get_map("view")

  def record(key, value)
    edit { doc.get_map("activity")["last"] = JSON.generate(by: "Agent", color: COLOR, key:, value:, at: epoch_ms) }
  end

  private

  def asks = doc.get_map("asks")

  # Asks are JSON strings in the "asks" map, written by the page.
  def answer_asks
    asks.keys.filter_map { |id| [id, JSON.parse(asks[id])] if asks[id].is_a?(String) }
        .select { |_id, request| request["status"] == "asked" }
        .sort_by { |_id, request| request["at"].to_f }
        .each { |id, request| answer(id, request) }
  end

  def answer(id, request)
    update_ask(id, request, "status" => "working")
    self.presence = presence_for("working on “#{request["prompt"]}”")
    reply = ask("#{request["by"]} asks: #{request["prompt"]}")
    update_ask(id, request, "status" => "done", "reply" => reply&.content.to_s.strip.presence || "Done.")
  rescue StandardError => e
    Rails.logger.warn("ViewAgent: #{e.class}: #{e.message}")
    update_ask(id, request, "status" => "failed", "reply" => "That failed: #{e.message[0, 120]}")
  ensure
    self.presence = presence_for("here")
  end

  def update_ask(id, request, changes) = edit { asks[id] = JSON.generate(request.merge(changes)) }

  def presence_for(status) = { "user" => { "name" => "Agent", "color" => COLOR, "agent" => true, "status" => status } }

  def epoch_ms = (Time.now.to_f * 1000).to_i
end
