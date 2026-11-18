RubyLLM::ReActionView.configure do |config|
  # The chat each conversation starts from. Configure RubyLLM's keys as usual.
  # config.chat = -> { RubyLLM.chat(model: "gpt-5-mini") }

  # Who may use the page agent. Runs in the channel, so connection
  # identifiers like current_user are available. Unset, it's allowed
  # everywhere except production.
  # config.authorize = -> { current_user.present? }
end
