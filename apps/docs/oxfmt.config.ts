import config from "@embedly/config/oxfmt.config.ts";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...config,
  ignorePatterns: [...config.ignorePatterns, "src/routeTree.gen.ts"],
});
