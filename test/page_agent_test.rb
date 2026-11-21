require_relative "test_helper"

class PageAgentTest < Minitest::Test
  Config = RubyLLM::ReActionView::PageAgent::Config

  def test_defaults
    config = Config.new
    assert_equal 10, config.timeout
    assert_match(/plain text/, config.instructions)
  end

  def test_authorize_runs_in_the_channel
    config = Config.new
    config.authorize = -> { allowed }
    assert config.authorized?(Struct.new(:allowed).new(true))
    refute config.authorized?(Struct.new(:allowed).new(false))
  end

  def test_unset_authorize_denies_outside_rails
    refute Config.new.authorized?(Object.new)
  end
end
