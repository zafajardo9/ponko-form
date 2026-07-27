import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({
      consolePiping: {
        enabled: false,
      },
    }),
    tailwindcss(),
    tanstackStart(),
    // server.js is Render's Node process wrapper, not a web-standard Nitro
    // handler. Disable Nitro's root server-file auto-detection so TanStack
    // Start's SSR service becomes the Vercel function entry.
    nitro({ serverEntry: false }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});

export default config;
