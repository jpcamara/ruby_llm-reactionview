module RubyLLM
  module ReActionView
    # A view backed by the browser tab showing the page. The tab holds the
    # states. Each call becomes a request to the tab, and its answer goes
    # back to the model.
    #
    # The tab reports which templates it rendered, and the tools are built
    # from those files on disk, so the model may set only what they allow.
    # `request` sends a Hash to the tab ({ "type" => "look" } or
    # { "type" => "set", "changes" => [...] }) and returns its reply.
    class TabView
      MAX_TEMPLATES = 20

      # snapshot: { "templates" => [{ "file", "version", "repeated" }] }
      def self.for(snapshot, root:, &request)
        entries = snapshot["templates"] || [snapshot]
        raise InvalidValue, "the page has no states to work with" if entries.empty?
        raise InvalidValue, "the page has too many stateful templates" if entries.size > MAX_TEMPLATES

        templates = entries.map do |entry|
          template = Template.new(path_in(entry["file"], root), root:, repeated: entry["repeated"] == true)
          if template.version != entry["version"]
            raise InvalidValue, "the page is from an older version of #{template.path}; reload it"
          end

          template
        end
        new(Page.new(templates), &request)
      end

      # Only files under app/views are accepted.
      def self.path_in(file, root)
        views = File.expand_path("app/views", root.to_s)
        path = File.expand_path(file.to_s, root.to_s)
        raise InvalidValue, "#{file} isn't a view" unless !file.to_s.empty? && path.start_with?("#{views}/") && File.file?(path)

        file
      end

      attr_reader :page

      def initialize(page, &request)
        @page = page.is_a?(Template) ? Page.new([page]) : page
        @request = request
      end

      def tools = page.tools(self)

      def look_description
        "What the page shows now: each template's states, its keyed rows (or renderings, for a " \
          "repeated partial) with their states and text, and the page's visible text."
      end

      def look = answer(@request.call("type" => "look"))

      def set(changes)
        payload = changes.map { |change| { "file" => change.file, "name" => change.name, "row" => change.row, "value" => change.value } }
        answer(@request.call("type" => "set", "changes" => payload))
      end

      private

      def answer(reply)
        raise InvalidValue, reply["error"] if reply.is_a?(::Hash) && reply["error"]

        reply
      end
    end
  end
end
