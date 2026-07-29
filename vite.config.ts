import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const config = defineConfig(({ mode }) => {
  const isCloudflare = mode === "cloudflare";

  return {
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
      ...(isCloudflare
        ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
        : []),
      devtools({
        consolePiping: {
          enabled: false,
        },
      }),
      tailwindcss(),
      tanstackStart(),
      // Keep the Node/Nitro output for Render and use Cloudflare's native
      // Workers runtime only for the dedicated Cloudflare build mode.
      ...(!isCloudflare ? [nitro({ serverEntry: false })] : []),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  };
});

export default config;
