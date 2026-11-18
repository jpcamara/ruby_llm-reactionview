require "ruby_llm"
require "herb"
require "herb/engine"
require "herb/engine/slots/manifest/collector"
require_relative "reactionview/version"
require_relative "reactionview/controls"
require_relative "reactionview/template"
require_relative "reactionview/tools"
require_relative "reactionview/tab_view"

module RubyLLM
  # Tools that let a model change what a ReActionView page shows, built from
  # the template's own herb:state declarations.
  module ReActionView
    # A value the page can't take. The tools send its message back to the
    # model so it can try again.
    class InvalidValue < ArgumentError; end

    # One state to set. `row` is the row's herb:key, or nil for a page state.
    Change = Data.define(:name, :row, :value) do
      def row? = !row.nil?
    end
  end
end
