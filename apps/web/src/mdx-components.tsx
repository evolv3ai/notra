import type { MDXComponents } from "mdx/types";

import { MdxLink } from "@/components/mdx-link";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...components,
    a: MdxLink,
  };
}
