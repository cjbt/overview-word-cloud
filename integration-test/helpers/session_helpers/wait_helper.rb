module SessionHelpers
  module WaitHelper
    def wait_for_javascript_to_return_true(script, options)
      raise ArgumentError.new("Missing options[:wait]") if !options[:wait]
      start = Time.now
      while Time.now - start < options[:wait]
        if evaluate_script(script)
          return true
        end
      end
      raise Error.new("JavaScript `#{script}` did not return true, even after #{options[:wait]}s")
    end
  end
end
