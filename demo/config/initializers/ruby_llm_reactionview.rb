RubyLLM::ReActionView::PageAgent.configure do |config|
  config.chat = lambda {
    RubyLLM.chat(model: ENV.fetch("AGENT_MODEL", "accounts/fireworks/routers/glm-5p3-fast"),
                 provider: :openai, assume_model_exists: true).with_thinking(effort: :low)
  }
  config.authorize = -> { true } # a local demo with no sign-in
end
