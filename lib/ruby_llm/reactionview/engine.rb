require_relative "seeding"

module RubyLLM
  module ReActionView
    # Adds the gem's JavaScript to a Rails app's assets and importmap, loads
    # the Seeding concern, and defines page_agent_tag.
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
