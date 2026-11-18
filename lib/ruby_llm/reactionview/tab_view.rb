module RubyLLM
  module ReActionView
    # A view backed by the browser tab showing the page. The tab holds the
    # states, so the app writes no `look` or `set`: each call becomes a
    # request to the tab, and its answer goes back to the model.
    #
    # `request` takes a Hash ({ "type" => "look" } or { "type" => "set",
    # "changes" => [...] }), sends it to the tab, and returns the tab's reply.
    # The bundled client answers both with a snapshot of the page: its states,
    # its keyed rows with their states and text, and the page's text.
    class TabView
      def self.for(snapshot, root:, &request)
        template = Template.new(path_in(snapshot.fetch("file"), root), root:)
        if template.version != snapshot["version"]
          raise InvalidValue, "the page is from an older version of #{template.path}; reload it"
        end

        new(template, &request)
      end

      # The tab says which template it rendered. Only a file under app/views
      # is accepted.
      def self.path_in(file, root)
        views = File.expand_path("app/views", root.to_s)
        path = File.expand_path(file.to_s, root.to_s)
        raise InvalidValue, "#{file} isn't a view" unless path.start_with?("#{views}/") && File.file?(path)

        file
      end

      attr_reader :template

      def initialize(template, &request)
        @template = template
        @request = request
      end

      def tools = template.tools(self)

      def look_description
        "What the page shows now: each state's value, the keyed rows on the page with their " \
          "states and text, and the page's text."
      end

      def look = answer(@request.call("type" => "look"))

      def set(changes)
        payload = changes.map { |change| { "name" => change.name, "row" => change.row, "value" => change.value } }
        answer(@request.call("type" => "set", "file" => template.path, "changes" => payload))
      end

      private

      def answer(reply)
        raise InvalidValue, reply["error"] if reply.is_a?(Hash) && reply["error"]

        reply
      end
    end
  end
end
