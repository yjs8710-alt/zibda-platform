import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { writeFileSync } from "node:fs";

// Build version used to detect fresh deployments. Changes on every build.
const BUILD_VERSION = "STABLE_LOAD_FIX_20260508_02";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_VERSION),
    __APP_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "jibda-build-id",
      buildStart() {
        writeFileSync(
          path.resolve(__dirname, "public/version.json"),
          `${JSON.stringify({ build: BUILD_VERSION }, null, 2)}\n`
        );
      },
      transformIndexHtml(html: string) {
        return html.replace(
          '<link rel="manifest" href="/manifest.webmanifest" />',
          `<link rel="manifest" href="/manifest.webmanifest?v=${BUILD_VERSION}" />`
        ).replace(
          "</head>",
          `<meta name="app-build-version" content="${BUILD_VERSION}" /></head>`
        );
      },
      generateBundle(this: { emitFile: (file: { type: "asset"; fileName: string; source: string }) => void }) {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ build: BUILD_VERSION }, null, 2),
        });
      },
    },
  ].filter(Boolean) as Plugin[],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react-core";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns")) return "date";
          if (id.includes("react-day-picker") || id.includes("embla-carousel") || id.includes("vaul") || id.includes("input-otp") || id.includes("cmdk")) return "ui-extras";
          if (id.includes("leaflet")) return "maps";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
