/**
 * Prompt Template Engine - Dynamic prompt generation with conditional logic
 *
 * Provides a simple but powerful templating system for generating dynamic prompts
 * with conditional sections and variable substitution. Essential for creating
 * context-aware prompts that adapt based on available data and execution state.
 *
 * ## Template Syntax
 *
 * - **Variables**: `{{variableName}}` - Replaced with data values
 * - **Conditionals**: `<if variableName>content</if>` - Include content only if variable has value
 * - **Arrays**: Empty arrays are treated as falsy for conditionals
 * - **Types**: Automatic JSON serialization for non-string values
 *
 * ## Use Cases
 *
 * - **Agent Prompts**: Generate system prompts with optional capabilities
 * - **Dynamic Context**: Include relevant information only when available
 * - **Configuration**: Adapt prompts based on agent configuration
 * - **Tool Integration**: Include tool descriptions conditionally
 *
 * @example
 * ```typescript
 * const template = `
 * You are a helpful assistant.
 * &lt;if userName&gt;
 * You are talking to {{userName}}.
 * &lt;/if&gt;
 * Current task: {{task}}
 * `;
 *
 * const result = PromptTemplate.render(template, {
 *   userName: "Alice",
 *   task: "Help with math homework"
 * });
 * ```
 */
export class PromptTemplate {
  /**
   * Renders a template string with conditional logic and variable substitution
   *
   * Processes template syntax to generate dynamic prompts that adapt to available data.
   * Supports conditional sections and automatic type conversion for flexible prompt generation.
   *
   * @param template - Template string with conditional and variable syntax
   * @param data - Data object containing values for template variables
   * @returns Rendered template with conditions evaluated and variables substituted
   *
   * @remarks
   * Template processing order:
   * 1. **Conditional evaluation**: `<if>` blocks processed first
   * 2. **Variable substitution**: `{{variable}}` placeholders replaced
   * 3. **Type conversion**: Non-strings automatically JSON-serialized
   * 4. **Whitespace preservation**: Conditional newlines maintained appropriately
   */
  public static render(template: string, data: Record<string, any>): string {
    let result = template;

    result = result.replace(
      /\n?<if\s+(\w+)>([\s\S]*?)<\/if>\n?/g,
      (match, varName, content) => {
        const value = data[varName];
        let hasValue = value !== undefined && value !== null && value !== "";
        if (hasValue && Array.isArray(value) && value.length == 0) {
          hasValue = false;
        }
        if (content.startsWith("\n")) {
          content = content.substring(1);
        }
        if (content.endsWith("\n")) {
          content = content.substring(0, content.length - 1);
        }
        if (!hasValue) {
          return "";
        }
        let result = this.replaceVars(content, data);
        if (match.startsWith("\n")) {
          result = "\n" + result;
        }
        if (match.endsWith("\n")) {
          result = result + "\n";
        }
        return result;
      }
    );

    result = this.replaceVars(result, data);

    return result;
  }

  private static replaceVars(text: string, data: Record<string, any>) {
    return text.replace(
      /\{\{([\w]+)\}\}/g,
      (match: string, varName: string) => {
        if (!(varName in data)) {
          return match;
        }
        const value = data[varName] ?? "";
        return typeof value == "string" ? value : JSON.stringify(value);
      }
    );
  }
}
