import { COMPONENT_NAME } from "../constants/builtins";
import type {
  ClientDirectiveElement,
  StaticDirectiveAnalysis,
} from "../types/mdx";

export function analyzeStaticDirectives(
  elements: readonly ClientDirectiveElement[],
  components: ReadonlySet<string>
): StaticDirectiveAnalysis {
  const result: StaticDirectiveAnalysis = { edits: [], invalid: [] };
  for (const element of elements) {
    const directive = element.directives.find(
      (attribute) => attribute.name === "client:static"
    );
    if (!directive) {
      continue;
    }
    const root = element.name.split(".")[0] ?? "";
    if (
      !COMPONENT_NAME.test(root) ||
      !components.has(root) ||
      directive.hasValue ||
      element.directives.length !== 1
    ) {
      result.invalid.push(element.start);
      continue;
    }
    result.edits.push({ start: directive.start, end: directive.end, text: "" });
  }
  return result;
}
