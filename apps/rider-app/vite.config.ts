import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(async ({ command }) => {
  /* PORT is only required for dev/preview, not for production builds */
  const rawPort = process.env.PORT;
  const isBuild = command === "build";

  if (!rawPort && !isBuild) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = rawPort ? Number(rawPort) : 3002;

  if (!isBuild && (Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH ?? "/rider";

  const devPlugins =
    process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            })
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : [];

  return {
    base: basePath,
    plugins: [
      {
        name: "base-path-redirect",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url ?? "/";
            if (
              url.startsWith("/@") ||
              url.startsWith("/node_modules/") ||
              url.startsWith("/__") ||
              url.startsWith("/favicon") ||
              url.startsWith("/api")
            ) {
              return next();
            }
            if (!url.startsWith(basePath)) {
              res.writeHead(302, { Location: basePath + "/" });
              res.end();
              return;
            }
            next();
          });
        },
      },
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      VitePWA({
        registerType: "autoUpdate",
        /* Explicitly set the output directory to match Vite's build.outDir so
           workbox does not glob dist/ root (which caused EISDIR on dist/public). */
        outDir: "dist/public",
        /* Only glob the compiled assets — no nested directory traversal. */
        workbox: {
          globDirectory: "dist/public",
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          /* Skip large chunks that should always be fetched fresh. */
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: `${basePath}/index.html`,
          navigateFallbackDenylist: [/^\/api\//],
        },
        manifest: {
          name: "AJKMart Rider",
          short_name: "AJKMart",
          description: "AJKMart Rider delivery partner app",
          theme_color: "#F0B90B",
          background_color: "#0F1117",
          display: "standalone",
          start_url: `${basePath}/`,
          icons: [
            { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
          ],
        },
      }),
      process.env.ANALYZE === "1" &&
        visualizer({ filename: "dist/bundle-stats.html", open: false, gzipSize: true }),
      ...devPlugins,
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
        "@workspace/theme": path.resolve(import.meta.dirname, "../../lib/theme/src/index.ts"),
        "@capacitor/browser": path.resolve(import.meta.dirname, "src/stubs/capacitor-browser.ts"),
        "@capacitor/push-notifications": path.resolve(import.meta.dirname, "src/stubs/capacitor-native.ts"),
        "@aparajita/capacitor-biometric-auth": path.resolve(import.meta.dirname, "src/stubs/capacitor-native.ts"),
        "@capacitor-community/play-integrity": path.resolve(import.meta.dirname, "src/stubs/capacitor-native.ts"),
        "@capacitor-community/app-attest": path.resolve(import.meta.dirname, "src/stubs/capacitor-native.ts"),
        "@capacitor-firebase/crashlytics": path.resolve(import.meta.dirname, "src/stubs/capacitor-native.ts"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-leaflet": ["leaflet", "react-leaflet"],
            "vendor-socket": ["socket.io-client"],
            "vendor-query": ["@tanstack/react-query"],
          },
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      hmr: process.env.REPL_ID
        ? {
            clientPort: 443,
            protocol: "wss",
            host: process.env.REPLIT_DEV_DOMAIN,
          }
        : undefined,
      proxy: {
        "/api": {
          target:
            process.env.VITE_API_PROXY_TARGET ?? `http://127.0.0.1:${process.env.API_PORT ?? 5000}`,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
