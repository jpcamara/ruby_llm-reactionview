module RubyLLM
  module ReActionView
    # A view kept in a store, for when the page's states live somewhere the
    # server can read: a session, a cache, or a yrby document.
    #
    #   view = RubyLLM::ReActionView::View.new(template, store: Stores::Hash.new(session[:herb_states] ||= {})) do |states|
    #     { rows: Invoice.view(**states.symbolize_keys).limit(40).as_json }
    #   end
    #   chat.with_tools(*view.tools)
    #
    # `look` returns every state's value, falling back to the template
    # default, plus the row states the store holds, plus whatever the block
    # returns. Subclass to check changes (check) or react to them (changed).
    class View
      attr_reader :page, :store

      def initialize(page, store:, qualified: nil, &extra)
        @page = page.is_a?(Template) ? Page.new([page]) : page
        @store = store
        @qualified = qualified.nil? ? !@page.single? : qualified
        @extra = extra
      end

      def tools = page.tools(self)

      def look
        states = page.templates.to_h { |template| [template.path, current(template)] }
        states = states.values.first if page.single?
        extra = @extra ? @extra.call(page.single? ? states["states"] : states).to_h.transform_keys(&:to_s) : {}
        (page.single? ? states : { "templates" => states }).merge(extra)
      end

      def set(changes)
        check(changes)
        changes.each do |change|
          store.write(key(change), change.value)
          changed(change)
        end
        look
      end

      # Raise InvalidValue to refuse changes, such as a row that doesn't exist.
      def check(changes) = nil

      # Runs after each change is written.
      def changed(change) = nil

      def key(change) = Address.key(change, qualified: @qualified)

      # The page states the store has, as Herb's render overrides:
      # { "app/views/invoices/index.html.erb" => { "status" => "open" } }.
      # Seeding uses these so a page renders with them.
      def seeds
        page.templates.reject(&:repeated?).to_h do |template|
          values = template.page_states.filter_map do |state|
            value = store.read(key(Change.new(file: template.path, name: state.name, value: nil)))
            [state.name, value] unless value.nil?
          end
          [template.path, values.to_h]
        end.reject { |_file, values| values.empty? }
      end

      private

      def current(template)
        read = ->(name, row) { store.read(key(Change.new(file: template.path, name:, row:, value: nil))) }
        result = {}
        unless template.repeated?
          result["states"] = template.page_states.to_h do |state|
            value = read.(state.name, nil)
            [state.name, value.nil? ? state.default : value]
          end
        end
        rows = rows_in_store(template)
        result["rows"] = rows unless rows.empty?
        result
      end

      # Rows the store has values for: { "29" => { "expanded" => true } }.
      def rows_in_store(template)
        names = (template.repeated? ? template.page_states : template.row_states).map(&:name)
        store.keys.each_with_object({}) do |key, rows|
          file, name, row = Address.parse(key)
          next unless row && names.include?(name) && (!@qualified || file == template.path)

          (rows[row] ||= {})[name] = store.read(key)
        end
      end
    end
  end
end
