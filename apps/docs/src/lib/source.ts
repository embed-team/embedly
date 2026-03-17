import { addCollection, Icon } from "@iconify/react/offline";
import phosphorIcons from "@iconify-json/ph/icons.json";
import simpleIcons from "@iconify-json/simple-icons/icons.json";
import { docs } from "collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { createElement } from "react";

addCollection(phosphorIcons as Parameters<typeof addCollection>[0]);
addCollection(simpleIcons as Parameters<typeof addCollection>[0]);

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
  icon: (name) => {
    if (!name) return;
    return createElement(Icon, { icon: name });
  },
  plugins: [lucideIconsPlugin()]
});

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title}

${processed}`;
}
