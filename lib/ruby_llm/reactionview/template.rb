module RubyLLM
  module ReActionView
    # What a model may change on a page, read from the template.
    #
    # Herb's compiled manifest names each state, its kind, its default, and
    # whether it belongs to the page or to a keyed row. A string state's
    # allowed values come from the page's controls, so a model can set what a
    # person could set by clicking, and nothing else. A string set from a
    # text field takes any text.
    #
    #   template = RubyLLM::ReActionView::Template.new("app/views/invoices/index.html.erb", root: Rails.root)
    #   chat.with_tools(*template.tools(view))
    class Template
      State = Data.define(:name, :kind, :default, :row, :choices) do
        def row? = row
        def free_text? = kind == "string" && choices.empty?
      end

      attr_reader :path, :version, :states

      def initialize(path, root: Dir.pwd)
        @path = path.to_s
        file = File.expand_path(@path, root.to_s)
        manifest = Template.manifest(file, root.to_s)
        @version = manifest["version"]
        choices = Controls.choices(File.read(file))
        @states = manifest.dig("states", "declarations").map do |declaration|
          State.new(name: declaration["name"], kind: declaration["kind"].to_s, default: declaration["value"],
                    row: declaration["scope"] != "region", choices: choices[declaration["name"]].uniq)
        end
      end

      # The compiled manifest Herb keeps for one template.
      def self.manifest(file, root)
        collector = Herb::Engine::Slots::Manifest::Collector.new(project_path: root)
        key = collector.add(file)
        raise ArgumentError, "#{file} didn't compile: #{collector.failures.first&.error&.message}" unless key

        manifest = collector.manifests.fetch(key)
        raise ArgumentError, "#{file} declares no herb:state" unless manifest["states"]

        manifest
      end

      def page_states = states.reject(&:row?)
      def row_states = states.select(&:row?)
      def [](name) = states.find { |state| state.name == name.to_s }

      # The tools for this page. `view` reads and writes the page's states;
      # see Tools for what it answers.
      def tools(view) = Tools.for(self, view)

      # The JSON schema for one state's value.
      def json_type(state)
        case state.kind
        when "boolean" then { type: "boolean" }
        when "integer" then { type: "integer" }
        else state.choices.any? ? { type: "string", enum: state.choices } : { type: "string" }
        end
      end

      # Checks and converts a value the model sent.
      def cast(state, value)
        case state.kind
        when "boolean"
          raise InvalidValue, "#{state.name} is true or false" unless [true, false, "true", "false"].include?(value)

          [true, "true"].include?(value)
        when "integer"
          Integer(value)
        else
          value = value.to_s
          unless state.choices.empty? || state.choices.include?(value)
            raise InvalidValue, "#{state.name} is one of #{state.choices.join(", ")}"
          end

          value
        end
      rescue TypeError, ArgumentError => e
        raise e if e.is_a?(InvalidValue)

        raise InvalidValue, "#{state.name} is a whole number"
      end
    end
  end
end
