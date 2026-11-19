# The team's shared screen. Its `view` document holds the invoices page's
# shared states (a Y.Map "view") and the asks people send the agent
# (a Y.Map "asks"). ViewChannel keeps it in memory, not in the database.
class Workspace < ApplicationRecord
  has_collaborative_document :view, channel: "ViewChannel"

  def self.default = first_or_create!(name: "Acme Billing")
end
