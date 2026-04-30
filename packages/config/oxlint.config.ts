import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "unicorn", "oxc", "import"],
  rules: {
    "no-debugger": "error",
  },
  ignorePatterns: ["dist/**"],
});
