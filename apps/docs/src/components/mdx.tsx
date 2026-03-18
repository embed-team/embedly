import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Icon } from "@/lib/icons";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Icon,
    ...components
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
