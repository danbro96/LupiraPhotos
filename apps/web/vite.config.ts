/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// Same-origin BFF: the .NET backend (dev: http://localhost:5183) owns /api and the /auth routes. The
// browser only talks to the Vite origin (:5176), which proxies these through — so the session cookie
// stays first-party and there is no CORS.
const backend = process.env.BACKEND_ORIGIN ?? "http://localhost:5183";
const proxied = ["/api", "/photo-api", "/auth", "/signin-oidc", "/signout-callback-oidc", "/livez", "/readyz"];

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset({ panicThreshold: "all_errors" })] })],
  server: {
    port: 5176,
    proxy: Object.fromEntries(
      proxied.map((path) => [path, { target: backend, changeOrigin: true, secure: false }]),
    ),
  },
  build: {
    // Single-container deploy: emit straight into the BFF's wwwroot.
    outDir: "../../src/LupiraPhotosBff/wwwroot",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        advancedChunks: {
          // Stable vendor chunk so app-code deploys don't re-download MUI/Emotion.
          groups: [{ name: "vendor-mui", test: /node_modules[\\/](@mui|@emotion)[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
