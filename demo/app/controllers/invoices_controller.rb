class InvoicesController < ApplicationController
  include RubyLLM::ReActionView::Seeding

  # The page starts in the shared view, not the template defaults.
  seed_herb_states { InvoicesView.seeds(Workspace.default) }

  def index
    @workspace = Workspace.default
    @invoices = Invoice.view(status: herb_state("status", "all"), sort: herb_state("sort", "due"),
                             query: herb_state("query", ""))
  end
end
