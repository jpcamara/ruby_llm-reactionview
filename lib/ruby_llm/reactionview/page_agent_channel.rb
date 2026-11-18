module RubyLLM
  module ReActionView
    # The channel behind <page-agent>. A tab sends its question with the
    # templates it rendered. The agent's tools come from those templates, and
    # each tool call is a request back to the tab, which reads or sets its
    # Herb states. Replies stream to the tab, and the conversation lasts as
    # long as the subscription.
    #
    # Action Cable keeps this instance for the whole subscription, which is
    # where the conversation lives. AnyCable builds one per command, so this
    # channel needs Action Cable.
    class PageAgentChannel < ::ActionCable::Channel::Base
      REPLIES = Concurrent::Map.new

      def subscribed
        reject unless ReActionView.config.authorized?(self)
      end

      def ask(data)
        id = data["id"]
        return say(id, "Still working on the last ask.") if @busy

        view = TabView.for(data.fetch("snapshot"), root: Rails.root) { |message| request(message) }
        @busy = true
        Thread.new { answer(id, data["prompt"].to_s, view) }
      rescue InvalidValue, KeyError => e
        say(id, e.message)
      end

      # Starts a new conversation.
      def reset(_data = nil) = @chat = nil

      # The tab's answer to a tool call.
      def reply(data) = REPLIES[data["id"]]&.push(data["result"])

      private

      def answer(id, prompt, view)
        chat = (@chat ||= ReActionView.config.chat.call.with_instructions(ReActionView.config.instructions))
        chat.with_tools(nil).with_tools(*view.tools)
        message = chat.ask(prompt) do |chunk|
          text = chunk.content
          transmit({ "type" => "delta", "id" => id, "text" => text }) if text.is_a?(String) && !text.empty?
        end
        say(id, message.content.to_s.strip.then { |text| text.empty? ? "Done." : text })
      rescue StandardError => e
        Rails.logger.warn("#{self.class}: #{e.class}: #{e.message}")
        say(id, "That failed: #{e.message[0, 120]}")
      ensure
        @busy = false
      end

      def say(id, text) = transmit({ "type" => "reply", "id" => id, "text" => text })

      # Sends a tool call to the tab and waits for its answer.
      def request(message)
        id = SecureRandom.uuid
        queue = REPLIES[id] = Queue.new
        transmit(message.merge("id" => id))
        queue.pop(timeout: ReActionView.config.timeout) or raise InvalidValue, "the page didn't answer"
      ensure
        REPLIES.delete(id)
      end
    end
  end
end
