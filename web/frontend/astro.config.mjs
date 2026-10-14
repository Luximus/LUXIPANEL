// @ts-check
import { internalModuleControllers } from "./scripts/internal-module-controllers.mjs";
import node from "@astrojs/node";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, passthroughImageService } from "astro/config";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = process.env.LUXIPANEL_URL ?? process.env.SITE_URL ?? "https://localhost:4321";

// Parse allowed hosts from environment variable or extract from SITE_URL
function getAllowedHosts() {
  if (process.env.ALLOWED_HOSTS) {
    return process.env.ALLOWED_HOSTS.split(",").map((h) => h.trim());
  }
  // Auto-extract hostname from SITE_URL and add localhost variants
  const url = new URL(SITE_URL);
  return [url.hostname, "localhost", "127.0.0.1"];
}

// https://astro.build/config
export default defineConfig({
  output: "server",
  compressHTML: true,
  site: SITE_URL,
  // Astro's built-in CSRF origin check compares the browser Origin against the
  // origin Astro computes from the request. Behind Cloudflare→nginx→node (plain
  // http, multi-domain: luxipanel.com + *.luxipanel.com like ats.luxipanel.com)
  // that computed origin never matches the real https Origin, so every multipart
  // POST proxied through /api (e.g. mail send) was rejected with a 403
  // "Cross-site ... form submissions are forbidden". CSRF is already enforced at
  // the backend (double-submit cookie + X-CSRF-Token on state-changing routes),
  // so this redundant, proxy-broken layer is disabled here.
  security: { checkOrigin: false },
  // This panel does not use astro:assets. Avoid processing untrusted AVIF
  // through Sharp/libheif; this deployment has no image optimization routes.
  image: { service: passthroughImageService() },
  build: {
    assets: "_luxi",
  },
  devToolbar: {
    enabled: false,
  },
  adapter: node({ mode: "standalone" }),
  integrations: [
    react(),
    sitemap({
      // Only index public-facing pages; /panel/* is behind auth (noindex anyway)
      filter: (page) =>
        !page.includes("/panel/") && !page.includes("/api/"),
      customPages: [SITE_URL + "/", SITE_URL + "/login"],
      changefreq: "weekly",
      priority: 0.7,
    }),
  ],

  vite: {
    build: { rollupOptions: { external: [/^\/scripts\//] } },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      allowedHosts: getAllowedHosts(),
      watch: {
        usePolling: true,
        interval: 500,
      },
    },
    plugins: [tailwindcss(), internalModuleControllers()],
  },
});
