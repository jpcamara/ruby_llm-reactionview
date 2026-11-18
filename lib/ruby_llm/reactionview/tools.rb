module RubyLLM
  module ReActionView
    # Builds a page's tools around a view, the object that holds its states:
    #
    #   view.look         # => what the page shows now, as a Hash for the model
    #   view.set(changes) # => applies an Array of Change; its return goes back
    #                     #    to the model
    #
    # A view may also answer `look_description`. Raise InvalidValue (or
    # ArgumentError) from `set` for a row that doesn't exist, and the model
    # gets the message.
    #
    # One template gets set_view and set_<row state>. With several, each tool
    # is prefixed with its template: set_invoices_view, set_totals_view. A
    # repeated partial gets one tool, set_<partial>(rows:, ...).
    module Tools
      def self.for(page, view)
        [LookAtPage.new(view), *page.templates.flat_map { |template| for_template(page, template, view) }]
      end

      def self.for_template(page, template, view)
        prefix = page.prefix(template)
        return [instances_tool(template, view, page.single? ? "set_#{template.slug}" : "set_#{prefix.chomp("_")}")] if template.repeated?

        [view_tool(template, view, "set_#{prefix}view"), *row_tools(template, view, prefix)].compact
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

      def self.where(template) = "#{template.path}"

      # One tool for a template's page states, each an optional parameter.
      def self.view_tool(template, view, name)
        states = template.page_states
        return if states.empty?

        Class.new(Tool) do
          define_method(:name) { name }
          description "Changes what #{Tools.where(template)} shows. Give only the states to change: " +
                      states.map { |state| "#{state.name} (defaults to #{state.default.inspect})" }.join(", ") + "."
          parameters(type: "object", properties: states.to_h { |state| [state.name, template.json_type(state)] },
                     required: [])

          define_method(:execute) do |**values|
            @view.set(Tools.changes(template, states, values, row: nil))
          end
        end.new(view)
      end

      # A tool per row state, such as set_expanded(rows:, value:).
      def self.row_tools(template, view, prefix)
        template.row_states.map do |state|
          Class.new(Tool) do
            define_method(:name) { "set_#{prefix}#{state.name}" }
            description "Sets #{state.name} on rows of #{Tools.where(template)}, by the row keys look_at_page shows."
            parameters(type: "object",
                       properties: { rows: { type: "array", items: { type: "string" } }, value: template.json_type(state) },
                       required: %w[rows value])

            define_method(:execute) do |rows:, value:|
              value = template.cast(state, value)
              @view.set(Array(rows).map { |row| Change.new(file: template.path, name: state.name, row: row.to_s, value:) })
            end
          end.new(view)
        end
      end

      # A repeated partial's states, set on some of its renderings at once.
      def self.instances_tool(template, view, name)
        states = template.page_states
        Class.new(Tool) do
          define_method(:name) { name }
          description "Sets states on renderings of #{Tools.where(template)}, by the row keys look_at_page shows. " \
                      "Give only the states to change: #{states.map(&:name).join(", ")}."
          parameters(type: "object",
                     properties: { rows: { type: "array", items: { type: "string" } },
                                   **states.to_h { |state| [state.name, template.json_type(state)] } },
                     required: %w[rows])

          define_method(:execute) do |rows:, **values|
            Array(rows).flat_map { |row| Tools.changes(template, states, values, row: row.to_s) }
                       .then { |changes| @view.set(changes) }
          end
        end.new(view)
      end

      def self.changes(template, allowed, values, row:)
        raise InvalidValue, "give at least one state to change" if values.empty?

        values.map do |name, value|
          state = allowed.find { |candidate| candidate.name == name.to_s }
          raise InvalidValue, "#{template.path} has no state #{name} to set here" unless state

          Change.new(file: template.path, name: state.name, row:, value: template.cast(state, value))
        end
      end
    end
  end
end
