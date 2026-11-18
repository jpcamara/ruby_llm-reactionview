require "ruby_llm"
require "herb"
require "herb/engine"
require "herb/engine/slots/manifest/collector"
require_relative "reactionview/version"
require_relative "reactionview/config"
require_relative "reactionview/address"
require_relative "reactionview/controls"
require_relative "reactionview/template"
require_relative "reactionview/page"
require_relative "reactionview/tools"
require_relative "reactionview/stores"
require_relative "reactionview/view"
require_relative "reactionview/tab_view"
require_relative "reactionview/engine" if defined?(Rails::Engine)

module RubyLLM
  # Tools that let a model change what a ReActionView page shows, built from
  # the templates' own herb:state declarations.
  module ReActionView
    # A value the page can't take. The tools send its message back to the
    # model so it can try again.
    class InvalidValue < ArgumentError; end

    # One state to set. `file` is the template that declares it, and `row` is
    # the row's herb:key (or the instance of a repeated partial), or nil for a
    # page state.
    Change = Data.define(:file, :name, :row, :value) do
      def initialize(name:, value:, row: nil, file: nil) = super
      def row? = !row.nil?
    end
  end
end
