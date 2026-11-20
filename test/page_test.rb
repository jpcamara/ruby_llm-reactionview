require_relative "test_helper"

class PageTest < Minitest::Test
  ROOT = File.expand_path("fixtures", __dir__)
  R = RubyLLM::ReActionView

  def setup
    @page = R::Page.new([R::Template.new("app/views/invoices/index.html.erb", root: ROOT),
                         R::Template.new("app/views/invoices/_totals.html.erb", root: ROOT),
                         R::Template.new("app/views/invoices/_card.html.erb", root: ROOT, repeated: true)])
    @store = R::Stores::Hash.new
    @view = R::View.new(@page, store: @store)
    @tools = @view.tools.to_h { [_1.name, _1] }
  end

  def test_tools_are_named_per_template
    assert_equal %w[look_at_page set_invoices_view set_invoices_expanded set_totals_view set_card], @tools.keys
    assert_equal %w[usd eur], @tools["set_totals_view"].parameters_schema.dig("properties", "currency", "enum")
    assert_equal %w[rows], @tools["set_card"].parameters_schema["required"]
  end

  def test_changes_carry_their_template_and_use_qualified_keys
    @tools["set_totals_view"].call(open: true)
    @tools["set_card"].call(rows: %w[4 5], pinned: "true")
    @tools["set_invoices_expanded"].call(rows: ["9"], value: true)
    assert_equal({ "app/views/invoices/_totals.html.erb#open" => true,
                   "app/views/invoices/_card.html.erb#pinned@4" => true,
                   "app/views/invoices/_card.html.erb#pinned@5" => true,
                   "app/views/invoices/index.html.erb#expanded@9" => true }, @store.instance_variable_get(:@hash))
  end

  def test_look_reads_the_store_with_defaults
    @tools["set_totals_view"].call(currency: "eur")
    @tools["set_card"].call(rows: ["4"], pinned: true)
    look = @view.look["templates"]
    assert_equal({ "open" => false, "currency" => "eur" }, look["app/views/invoices/_totals.html.erb"]["states"])
    assert_equal({ "4" => { "pinned" => true } }, look["app/views/invoices/_card.html.erb"]["rows"])
    assert_equal "all", look["app/views/invoices/index.html.erb"]["states"]["status"]
  end

  def test_seeds_are_herb_overrides_for_page_states_only
    @tools["set_invoices_view"].call(status: "paid")
    @tools["set_card"].call(rows: ["4"], pinned: true)
    assert_equal({ "app/views/invoices/index.html.erb" => { "status" => "paid" } }, @view.seeds)
  end

  def test_a_repeated_partial_alone_gets_its_own_name
    page = R::Page.new([R::Template.new("app/views/invoices/_card.html.erb", root: ROOT, repeated: true)])
    assert_equal %w[look_at_page set_card], page.tools(@view).map(&:name)
  end
end

class ViewTest < Minitest::Test
  ROOT = File.expand_path("fixtures", __dir__)
  R = RubyLLM::ReActionView

  class Checked < R::View
    attr_reader :seen

    def check(changes)
      bad = changes.select(&:row?).reject { _1.row.to_i.between?(1, 30) }
      raise R::InvalidValue, "no invoice #{bad.map(&:row).join(", ")}" if bad.any?
    end

    def changed(change) = (@seen ||= []) << change.name
  end

  def setup
    @hash = {}
    template = R::Template.new("app/views/invoices/index.html.erb", root: ROOT)
    @view = Checked.new(template, store: R::Stores::Hash.new(@hash)) { |states| { "count" => states["status"] == "all" ? 30 : 3 } }
    @tools = @view.tools.to_h { [_1.name, _1] }
  end

  def test_single_template_keys_and_look
    result = @tools["set_view"].call(status: "open")
    @tools["set_expanded"].call(rows: ["3"], value: true)
    assert_equal({ "status" => "open", "expanded@3" => true }, @hash)
    assert_equal 3, result["count"]
    assert_equal({ "3" => { "expanded" => true } }, @view.look["rows"])
    assert_equal %w[status expanded], @view.seen
  end

  def test_check_refuses
    assert_equal({ error: "no invoice 99" }, @tools["set_expanded"].call(rows: ["99"], value: true))
    assert_empty @hash
  end
end
