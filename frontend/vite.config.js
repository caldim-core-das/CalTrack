import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  // Base path for subpath deployment at caldimproducts.com/Caltrack
  base: process.env.NODE_ENV === "production" ? "/Caltrack/" : "/",

  plugins: [
    react({
      // Only transform files that actually use JSX — skips plain JS
      include: "**/*.{jsx,tsx}",
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    // Warm up the most-visited pages so the first dev request is instant
    warmup: {
      clientFiles: [
        "./src/ui/pages/LoginPage.jsx",
        "./src/ui/pages/DashboardPage.jsx",
        "./src/ui/App.jsx",
      ],
    },
  },

  build: {
    // Raise warning threshold — vendor chunks are intentionally large
    chunkSizeWarningLimit: 1000,

    // Skip compressed-size reporting to speed up CI builds
    reportCompressedSize: false,

    // esbuild minifier: same output size as terser, 10–20x faster
    minify: "esbuild",

    // Split CSS per chunk so each page only downloads the styles it needs
    cssCodeSplit: true,

    // Target modern browsers — smaller output, no polyfill bloat
    target: "es2020",

    rollupOptions: {
      output: {
        // Function-based manualChunks gives finer control than the static map.
        // Each vendor is cached independently — pages don't pay for unused deps.
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/scheduler/")
          ) return "vendor-react"

          if (
            id.includes("node_modules/@reduxjs/") ||
            id.includes("node_modules/react-redux/") ||
            id.includes("node_modules/immer/")
          ) return "vendor-state"

          if (id.includes("node_modules/lucide-react/"))
            return "vendor-icons"

          if (
            id.includes("node_modules/chart.js/") ||
            id.includes("node_modules/react-chartjs-2/")
          ) return "vendor-charts"

          // Maps — only loaded on Locations / Live-Locations pages
          if (
            id.includes("node_modules/leaflet/") ||
            id.includes("node_modules/react-leaflet/") ||
            id.includes("node_modules/leaflet-draw/")
          ) return "vendor-maps"

          if (id.includes("node_modules/@react-oauth/"))
            return "vendor-oauth"

          // ML face models — largest asset, isolated so cache isn't busted
          if (
            id.includes("node_modules/face-api") ||
            id.includes("node_modules/@vladmandic/")
          ) return "vendor-faceapi"
        },
      },
    },
  },

  // Pre-bundle core deps for a faster dev cold-start
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@reduxjs/toolkit",
      "react-redux",
      "lucide-react",
    ],
  },
})
