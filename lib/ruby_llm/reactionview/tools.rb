module RubyLLM
  module ReActionView
    # Builds a page's tools around a view, the app's object for its states:
    #
    #   view.look         # => what the page shows now, as a Hash for the model
    #   view.set(changes) # => applies an Array of Change; its return goes back
    #                     #    to the model
    #
    # A view may also answer `look_description` to describe what `look`
    # returns. Raise InvalidValue (or ArgumentError) from `set` for a row that
    # doesn't exist, and the model gets the message.
    module Tools
      def self.for(template, view)
        [LookAtPage.new(view), set_view(template, view), *row_tools(template, view)]
      end

      class Tool < RubyLLM::Tool
        def initialize(view)
          super()
          @view = view
        end

        def call(tool_call: nil, **arguments)
          super
        rescue ArgumentError, TypeError => e
          { error: e.message }
        end
      end

      class LookAtPage < Tool
        def name = "look_at_page"

        def description
          @view.respond_to?(:look_description) ? @view.look_description : "What the page shows now."
        end

        def execute = @view.look
      end

      # One tool for the page's states, each an optional parameter.
      def self.set_view(template, view)
        states = template.page_states
        Class.new(Tool) do
          define_method(:name) { "set_view" }
          description "Changes what the page shows. Give only the states to change: " +
                      states.map { |state| "#{state.name} (defaults to #{state.default.inspect})" }.join(", ") + "."
          parameters(type: "object", properties: states.to_h { |state| [state.name, template.json_type(state)] },
                     required: [])

          define_method(:execute) do |**values|
            raise InvalidValue, "give at least one state to change" if values.empty?

            @view.set(values.map do |name, value|
              state = template[name]
              raise InvalidValue, "the page has no state #{name}" unless state && !state.row?

              Change.new(name: state.name, row: nil, value: template.cast(state, value))
            end)
          end
        end.new(view)
      end

      # A tool per row state, such as set_expanded(rows:, value:).
      def self.row_tools(template, view)
        template.row_states.map do |state|
          Class.new(Tool) do
            define_method(:name) { "set_#{state.name}" }
            description "Sets #{state.name} on rows, by the row keys look_at_page shows."
            parameters(type: "object",
                       properties: { rows: { type: "array", items: { type: "string" } }, value: template.json_type(state) },
                       required: %w[rows value])

            define_method(:execute) do |rows:, value:|
              value = template.cast(state, value)
              @view.set(Array(rows).map { |row| Change.new(name: state.name, row: row.to_s, value:) })
            end
          end.new(view)
        end
      end
    end
  end
end
