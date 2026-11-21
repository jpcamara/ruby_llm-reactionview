require_relative "seeding"

module RubyLLM
  module ReActionView
    # Adds the gem's JavaScript to a Rails app's assets and importmap, and
    # loads the Seeding concern.
    class Engine < ::Rails::Engine
      initializer "ruby_llm_reactionview.assets" do |app|
        app.config.assets.paths << root.join("app/javascript") if app.config.respond_to?(:assets)
      end

      initializer "ruby_llm_reactionview.importmap", before: "importmap" do |app|
        app.config.importmap.paths << root.join("config/importmap.rb") if app.config.respond_to?(:importmap)
      end
    end
  end
end
