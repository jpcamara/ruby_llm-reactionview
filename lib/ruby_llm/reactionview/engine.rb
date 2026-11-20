require_relative "seeding"
require_relative "page_agent_channel" if defined?(::ActionCable)

module RubyLLM
  module ReActionView
    # Ships the page agent to a Rails app: the channel, the JavaScript
    # (importmap pin "ruby_llm-reactionview"), and the page_agent_tag helper.
    class Engine < ::Rails::Engine
      initializer "ruby_llm_reactionview.assets" do |app|
        app.config.assets.paths << root.join("app/javascript") if app.config.respond_to?(:assets)
      end

      initializer "ruby_llm_reactionview.importmap", before: "importmap" do |app|
        app.config.importmap.paths << root.join("config/importmap.rb") if app.config.respond_to?(:importmap)
      end

      initializer "ruby_llm_reactionview.helpers" do
        ActiveSupport.on_load(:action_view) do
          define_method(:page_agent_tag) { |**options| tag.page_agent(**options) }
        end
      end

    end
  end
end
