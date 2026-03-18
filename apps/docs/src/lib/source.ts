import { docs } from "collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { createElement } from "react";
import { icon_map } from "./icons";

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  icon: (name) => {
    if (!name) return;
    const component = icon_map[name];
    if (!component) return;
    return createElement(component);
  }
});

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title}

${processed}`;
}
