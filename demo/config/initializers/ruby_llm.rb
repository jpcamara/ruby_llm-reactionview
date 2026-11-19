if ENV["FIREWORKS_API_KEY"].present?
  require "ruby_llm"
  RubyLLM.configure do |config|
    config.openai_api_key = ENV.fetch("FIREWORKS_API_KEY")
    config.openai_api_base = "https://api.fireworks.ai/inference/v1"
    config.request_timeout = 30
  end
end
