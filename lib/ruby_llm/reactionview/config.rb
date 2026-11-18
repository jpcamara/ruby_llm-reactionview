module RubyLLM
  module ReActionView
    # Settings for the bundled page agent.
    #
    #   RubyLLM::ReActionView.configure do |config|
    #     config.chat = -> { RubyLLM.chat(model: "gpt-5-mini") }
    #     config.authorize = -> { current_user.present? } # runs in the channel
    #   end
    class Config
      INSTRUCTIONS = <<~TEXT.freeze
        You work a web page for the person looking at it. You change what it
        shows through its states, with your tools, and they see each change
        happen. Look at the page first. Change only what the ask needs. Reply
        in one or two short sentences of plain text, with no Markdown.
      TEXT

      # chat: builds a RubyLLM chat for a new conversation.
      # instructions: the system prompt.
      # timeout: seconds a tab has to answer a tool call.
      # authorize: runs in the channel at subscribe; falsy rejects. When unset,
      #   only non-production environments allow the agent.
      attr_accessor :chat, :instructions, :timeout, :authorize

      def initialize
        @chat = -> { RubyLLM.chat }
        @instructions = INSTRUCTIONS
        @timeout = 10
        @authorize = nil
      end

      def authorized?(channel)
        return channel.instance_exec(&authorize) if authorize

        defined?(Rails) && !Rails.env.production?
      end
    end

    def self.config = @config ||= Config.new
    def self.configure = yield(config)
  end
end
