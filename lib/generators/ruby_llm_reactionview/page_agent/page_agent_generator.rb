require "rails/generators"

module RubyLlmReactionview
  # rails generate ruby_llm_reactionview:page_agent
  class PageAgentGenerator < Rails::Generators::Base
    namespace "ruby_llm_reactionview:page_agent"
    source_root File.expand_path("templates", __dir__)

    def initializer
      template "initializer.rb", "config/initializers/ruby_llm_reactionview_page_agent.rb"
    end

    def javascript
      application = "app/javascript/application.js"
      return say("Import \"ruby_llm-reactionview/page-agent\" in your JavaScript.", :yellow) unless File.exist?(application)

      append_to_file application, %(import "ruby_llm-reactionview/page-agent"\n) unless File.read(application).include?("ruby_llm-reactionview/page-agent")
    end

    def action_cable_pin
      importmap = "config/importmap.rb"
      return unless File.exist?(importmap) && !File.read(importmap).include?("@rails/actioncable")

      append_to_file importmap, %(pin "@rails/actioncable", to: "actioncable.esm.js"\n)
    end

    def layout
      say "Add <%= page_agent_tag %> to a layout or view to put the agent on those pages.", :green
    end
  end
end
