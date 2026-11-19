# Starts the view agent in this process. A real app would run it from a job,
# as the yrby board demo does.
class AgentsController < ApplicationController
  def create
    document = Workspace.default.collaborative_document(:view)
    url = "#{request.base_url.sub(/\Ahttp/, "ws")}/cable"
    origin = request.base_url
    [ViewAgent, ViewAgent::View, InvoicesView, Invoice] # load them here, not in the thread
    Thread.new do
      ViewAgent.run(document, url:, headers: { "Origin" => origin }, lock: nil, idle: 300)
    rescue StandardError => e
      Rails.logger.error("ViewAgent ended: #{e.class}: #{e.message}")
    end
    head :accepted
  end
end
