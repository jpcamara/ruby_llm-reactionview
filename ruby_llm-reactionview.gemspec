require_relative "lib/ruby_llm/reactionview/version"

Gem::Specification.new do |spec|
  spec.name = "ruby_llm-reactionview"
  spec.version = RubyLLM::ReActionView::VERSION
  spec.authors = ["JP Camara"]
  spec.summary = "RubyLLM tools from a ReActionView template's herb:state declarations"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.2"
  spec.files = Dir["lib/**/*.rb", "app/**/*", "config/**/*", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]

  spec.add_dependency "herb", "~> 0.11"
  spec.add_dependency "ruby_llm", ">= 1.6"
end
