require "active_support/concern"

module RubyLLM
  module ReActionView
    # Renders a page with state values the server already has, such as ones
    # an agent set or a shared document holds, instead of the template
    # defaults. The page then starts in that state with no flash.
    #
    #   class InvoicesController < ApplicationController
    #     include RubyLLM::ReActionView::Seeding
    #     seed_herb_states { session_view.seeds }
    #   end
    #
    # A block returns Herb's override shape, { file => { name => value } };
    # View#seeds builds it. When the page refetches, the states the tab sends
    # win, because it knows what it changed since. Controllers read seeded
    # values with herb_state as usual.
    #
    # This sets ReActionView's @__herb_state_overrides, which 0.6 itself fills
    # from the Herb-State header only on refetches, and reads on every render.
    # It relies on that internal, so check it when upgrading.
    module Seeding
      extend ActiveSupport::Concern

      included do
        class_attribute :herb_seeders, instance_writer: false, default: []
        prepend_before_action :apply_herb_seeds
      end

      # ReActionView no longer has the hook this fills, so seeds would be
      # dropped without a word. Say so once.
      def self.warn_unsupported(controller)
        return if @warned

        @warned = true
        message = "RubyLLM::ReActionView::Seeding: this ReActionView has no __herb_state_overrides, so pages render with template defaults"
        defined?(Rails) ? Rails.logger.warn(message) : Kernel.warn(message)
      end

      class_methods do
        def seed_herb_states(&block) = self.herb_seeders += [block]
      end

      private

      def apply_herb_seeds
        return if herb_seeders.empty?
        return Seeding.warn_unsupported(self) unless respond_to?(:__herb_state_overrides, true)

        seeds = herb_seeders.map { |seeder| instance_exec(&seeder) || {} }
                            .reduce({}) { |all, more| all.deep_merge(more.deep_stringify_keys) }
        return if seeds.empty?

        sent = __herb_state_overrides || {}
        @__herb_state_overrides = seeds.deep_merge(sent)
      end
    end
  end
end
