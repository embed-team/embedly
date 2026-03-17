import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true
    }
  }
});

export default defineConfig();
