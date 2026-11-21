class Invoice < ApplicationRecord
  STATUSES = %w[draft open overdue paid].freeze
  SORTS = %w[due amount customer number].freeze

  # The invoices a view shows. The controller and the agent both call this, so
  # what the agent "sees" is exactly what the page renders.
  def self.view(status: "all", sort: "due", query: "")
    scope = all
    scope = scope.where(status:) if STATUSES.include?(status)
    scope = scope.where("customer LIKE :q OR number LIKE :q", q: "%#{sanitize_sql_like(query)}%") if query.present?
    case sort
    when "amount" then scope.order(amount_cents: :desc)
    when "customer" then scope.order(:customer, :due_on)
    when "number" then scope.order(:number)
    else scope.order(:due_on)
    end
  end

  def amount = amount_cents / 100.0
end
