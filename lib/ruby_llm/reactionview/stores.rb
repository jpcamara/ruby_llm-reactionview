module RubyLLM
  module ReActionView
    # Where a View keeps state values: anything that answers read, write and
    # keys. Keys come from Address.
    module Stores
      # A Hash or anything Hash-like, such as session[:herb_states] or a
      # cache entry.
      class Hash
        def initialize(hash = {}) = @hash = hash
        def read(key) = @hash[key]
        def write(key, value) = @hash[key] = value
        def keys = @hash.keys.map(&:to_s)
      end

      # A Y::Map from yrby, or a block that returns one, for a document that
      # can be replaced (a Y::Agent builds a new one when it rejoins). Pass
      # `edit:` when writes have to go through an edit, as in a Y::Agent
      # (edit: method(:edit)), so they're recorded and broadcast.
      class YMap
        def initialize(map = nil, edit: nil, &block)
          @map = block || map
          @edit = edit
        end

        def read(key) = map.key?(key) ? map[key] : nil
        def keys = map.keys

        def write(key, value)
          @edit ? @edit.call { map[key] = value } : map[key] = value
        end

        private

        def map = @map.respond_to?(:call) ? @map.call : @map
      end
    end
  end
end
