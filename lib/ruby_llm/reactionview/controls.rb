module RubyLLM
  module ReActionView
    # Walks a template for the values its controls can set: the literals in
    # data-herb-set="status=open", and the <option>s of a select that sets
    # sort=$value.
    class Controls < Herb::Visitor
      def self.choices(source) = new.tap { |visitor| visitor.visit(Herb.parse(source).value) }.choices

      def choices = @choices ||= Hash.new { |hash, name| hash[name] = [] }

      def visit_html_element_node(node)
        attributes(node)["data-herb-set"]&.split&.each do |clause|
          name, value = clause.split("->").last.split("=", 2)
          if value == "$value"
            choices[name].concat(options(node)) if node.tag_name.value == "select"
          elsif value
            choices[name] << value.delete("'\"")
          end
        end
        super
      end

      private

      def attributes(node)
        node.open_tag.children.grep(Herb::AST::HTMLAttributeNode).to_h do |attribute|
          [text(attribute.name), attribute.value && text(attribute.value)]
        end
      end

      def options(select)
        select.body.grep(Herb::AST::HTMLElementNode).select { |child| child.tag_name.value == "option" }
              .filter_map { |option| attributes(option)["value"] }
      end

      def text(node) = node.children.map { |child| child.respond_to?(:content) ? child.content : "" }.join
    end
  end
end
