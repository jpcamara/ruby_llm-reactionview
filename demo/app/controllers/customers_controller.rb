# A page whose state lives in a partial rendered once per customer.
class CustomersController < ApplicationController
  def index
    @customers = Invoice.all.group_by(&:customer).transform_values { |invoices| invoices.sum(&:amount) }.sort
  end
end
