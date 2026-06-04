import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.ts"],
  outDir: "dist",
  format: "esm",
  target: "node24",
  platform: "node",
  dts: false,
  clean: true,
  sourcemap: false,
  copy: ["src/emojis"],
  deps: {
    alwaysBundle: ["@embedly/platforms", "@embedly/api", "@embedly/logging"],
    onlyBundle: false,
  },
});
