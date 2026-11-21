# The invoices page's shared view: its states in the workspace document's
# "view" Y.Map, read and written through ruby_llm-reactionview.
class InvoicesView < RubyLLM::ReActionView::View
  TEMPLATES = %w[app/views/invoices/index.html.erb app/views/invoices/_totals.html.erb].freeze

  def self.page = RubyLLM::ReActionView::Page.for(TEMPLATES, root: Rails.root)

  # The view the page renders with, from the document as it is in memory.
  def self.seeds(workspace)
    state = ViewChannel::STATES[workspace.collaborative_document(:view).key]
    return {} unless state

    doc = Y::Doc.new
    doc.apply_update(state)
    new(page, store: RubyLLM::ReActionView::Stores::YMap.new(doc.get_map("view"))).seeds
  end

  INDEX = TEMPLATES.first

  def states = look.dig("templates", INDEX, "states")

  # Row keys are invoice ids.
  def check(changes)
    rows = changes.select(&:row?).map(&:row)
    missing = rows - Invoice.where(id: rows).pluck(:id).map(&:to_s)
    raise RubyLLM::ReActionView::InvalidValue, "no invoice #{missing.join(", ")}" if missing.any?
  end
end
