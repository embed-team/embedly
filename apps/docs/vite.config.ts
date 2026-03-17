import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const bot_version = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../bot/package.json"),
    "utf-8"
  )
).version as string;

export default defineConfig({
  define: {
    __BOT_VERSION__: JSON.stringify(bot_version)
  },
  server: {
    port: 3000
  },
  plugins: [
    mdx(await import("./source.config")),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: false
      }
    }),
    react(),
    // please see https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nitro for guides on hosting
    nitro({
      preset: "cloudflare-module",
      cloudflare: {
        deployConfig: true
      }
    })
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js"
    }
  }
});
