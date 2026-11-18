require_relative "test_helper"

class TemplateTest < Minitest::Test
  ROOT = File.expand_path("fixtures", __dir__)

  # Records what the tools ask it to set.
  class View
    attr_reader :changes

    def look = { rows: [] }
    def set(changes) = (@changes = changes) && "ok"
  end

  def setup
    @template = RubyLLM::ReActionView::Template.new("app/views/invoices/index.html.erb", root: ROOT)
    @view = View.new
    @tools = @template.tools(@view).to_h { |tool| [tool.name, tool] }
  end

  def test_reads_states_and_choices
    assert_equal %w[status sort query page], @template.page_states.map(&:name)
    assert_equal %w[expanded], @template.row_states.map(&:name)
    assert_equal %w[all open paid], @template["status"].choices
    assert_equal %w[due amount], @template["sort"].choices
    assert @template["query"].free_text?
    assert_equal "integer", @template["page"].kind
    assert_equal "boolean", @template["expanded"].kind
  end

  def test_tools_and_parameter_types
    assert_equal %w[look_at_page set_view set_expanded], @tools.keys
    properties = @tools["set_view"].parameters_schema["properties"]
    assert_equal %w[all open paid], properties.dig("status", "enum")
    assert_equal "integer", properties.dig("page", "type")
  end

  def test_set_view_casts_and_hands_changes_to_the_view
    assert_equal "ok", @tools["set_view"].call(status: "open", page: "2")
    assert_equal [RubyLLM::ReActionView::Change.new(name: "status", row: nil, value: "open"),
                  RubyLLM::ReActionView::Change.new(name: "page", row: nil, value: 2)], @view.changes
  end

  def test_bad_values_go_back_to_the_model
    assert_equal({ error: "status is one of all, open, paid" }, @tools["set_view"].call(status: "late"))
    assert_equal({ error: "page is a whole number" }, @tools["set_view"].call(page: "two"))
    assert_equal({ error: "give at least one state to change" }, @tools["set_view"].call)
    assert_nil @view.changes
  end

  def test_row_tool
    @tools["set_expanded"].call(rows: [3, "7"], value: "true")
    assert_equal [%w[expanded 3], %w[expanded 7]], @view.changes.map { [_1.name, _1.row] }
    assert(@view.changes.all? { _1.value == true })
  end
end
