require_relative "test_helper"

class TabViewTest < Minitest::Test
  ROOT = File.expand_path("fixtures", __dir__)
  FILE = "app/views/invoices/index.html.erb"

  def setup
    @version = RubyLLM::ReActionView::Template.new(FILE, root: ROOT).version
    @sent = []
    @view = RubyLLM::ReActionView::TabView.for({ "file" => FILE, "version" => @version }, root: ROOT) do |message|
      @sent << message
      message["type"] == "look" ? { "states" => { "status" => "all" } } : { "error" => "no row 9 on the page" }
    end
  end

  def test_tools_talk_to_the_tab
    tools = @view.tools.to_h { [_1.name, _1] }
    assert_equal({ "states" => { "status" => "all" } }, tools["look_at_page"].call)
    tools["set_view"].call(status: "open")
    assert_equal({ "type" => "set", "file" => FILE, "changes" => [{ "name" => "status", "row" => nil, "value" => "open" }] },
                 @sent.last)
  end

  def test_tab_errors_go_back_to_the_model
    tool = @view.tools.find { _1.name == "set_expanded" }
    assert_equal({ error: "no row 9 on the page" }, tool.call(rows: ["9"], value: true))
  end

  def test_refuses_files_outside_views_and_stale_pages
    error = assert_raises(RubyLLM::ReActionView::InvalidValue) do
      RubyLLM::ReActionView::TabView.for({ "file" => "../../etc/passwd", "version" => "x" }, root: ROOT)
    end
    assert_match "isn't a view", error.message
    error = assert_raises(RubyLLM::ReActionView::InvalidValue) do
      RubyLLM::ReActionView::TabView.for({ "file" => FILE, "version" => "old" }, root: ROOT)
    end
    assert_match "reload", error.message
  end
end
