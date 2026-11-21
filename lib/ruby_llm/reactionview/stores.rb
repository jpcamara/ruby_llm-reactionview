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
    end
  end
end
