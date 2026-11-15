import type { Program } from "estree";
import type { Nodes } from "mdast";

import type {
  ClientDirective,
  MdxJsxAttribute,
  MdxJsxElement,
} from "../types/mdx";

export function isMdxJsxElement(node: Nodes): node is MdxJsxElement {
  return node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
}

export function clientDirectives(element: MdxJsxElement): ClientDirective[] {
  const start = element.position?.start.offset ?? 0;
  return element.attributes
    .filter(
      (attribute): attribute is MdxJsxAttribute =>
        attribute.type === "mdxJsxAttribute" &&
        attribute.name.startsWith("client:")
    )
    .map((attribute) => ({
      name: attribute.name,
      hasValue: attribute.value !== null,
      start: attribute.position?.start.offset ?? start,
      end: attribute.position?.end.offset ?? start,
    }));
}

export function expressionPrograms(node: Nodes): Program[] {
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    return node.data?.estree ? [node.data.estree] : [];
  }
  if (!isMdxJsxElement(node)) {
    return [];
  }
  return node.attributes.flatMap((attribute) => {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      return attribute.data?.estree ? [attribute.data.estree] : [];
    }
    const { value } = attribute;
    return typeof value === "object" && value?.data?.estree
      ? [value.data.estree]
      : [];
  });
}
