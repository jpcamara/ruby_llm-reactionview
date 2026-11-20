RubyLLM::ReActionView::PageAgent.configure do |config|
  # The chat each conversation starts from. Configure RubyLLM's keys as usual.
  # config.chat = -> { RubyLLM.chat(model: "gpt-5-mini") }

  # The system prompt. The default asks for short, plain replies.
  # config.instructions = "..."

  # Who may use the page agent. Runs in the channel, so connection
  # identifiers like current_user are available. Unset, it's allowed
  # everywhere except production.
  # config.authorize = -> { current_user.present? }
end
