import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: true,
  ignorePatterns: ["dist/**", "types/**"],
});
