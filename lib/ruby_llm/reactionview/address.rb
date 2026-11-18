module RubyLLM
  module ReActionView
    # Where a state lives in a store: "status" for a page state, and
    # "expanded@29" for a row's. On a page with more than one stateful
    # template the file comes first: "app/views/invoices/_totals.html.erb#open".
    # The JavaScript binding uses the same keys.
    module Address
      def self.key(change, qualified: false)
        base = change.row? ? "#{change.name}@#{change.row}" : change.name
        qualified ? "#{change.file}##{base}" : base
      end

      # [file or nil, name, row or nil]
      def self.parse(key)
        file, base = key.include?("#") ? key.split("#", 2) : [nil, key]
        name, row = base.split("@", 2)
        [file, name, row]
      end
    end
  end
end
