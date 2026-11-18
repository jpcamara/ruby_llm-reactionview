module RubyLLM
  module ReActionView
    # The stateful templates one page rendered: the page's own and any
    # partials that declare states.
    class Page
      attr_reader :templates

      def self.for(paths, root: Dir.pwd) = new(Array(paths).map { |path| Template.new(path, root:) })

      def initialize(templates)
        @templates = templates
        raise ArgumentError, "a page needs at least one template" if templates.empty?
      end

      def single? = templates.one?
      def [](file) = templates.find { |template| template.path == file.to_s }
      def tools(view) = Tools.for(self, view)

      # The prefix that keeps tool names apart when several templates have states.
      def prefix(template)
        return "" if single?

        name = template.slug
        same = templates.select { |other| other.slug == name }
        same.size > 1 ? "#{name}#{same.index(template) + 1}_" : "#{name}_"
      end
    end
  end
end
