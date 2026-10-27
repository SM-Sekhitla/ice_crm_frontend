import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.FRONTEND_PORT || "5173");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("FRONTEND_PORT must be an integer between 1 and 65535.");
  // Explicit deployment variables take priority over local .env defaults.
  const target =
    process.env.VITE_API_TARGET ||
    process.env.BACKEND_TARGET ||
    env.VITE_API_TARGET ||
    env.BACKEND_TARGET ||
    "http://127.0.0.1:5002";
  const targetUrl = new URL(target);
  if (
    !["http:", "https:"].includes(targetUrl.protocol) ||
    targetUrl.username ||
    targetUrl.password
  )
    throw new Error(
      "The API proxy target must be an HTTP(S) server URL without credentials.",
    );
  const rawHosts = env.VITE_ALLOWED_HOSTS?.trim() || "localhost,127.0.0.1";
  const allowedHosts: string[] = rawHosts.startsWith("[")
    ? JSON.parse(rawHosts)
    : rawHosts
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean);
  if (
    !Array.isArray(allowedHosts) ||
    !allowedHosts.length ||
    allowedHosts.some(
      (host) => typeof host !== "string" || !host || /[\s/:]/.test(host),
    )
  )
    throw new Error(
      "VITE_ALLOWED_HOSTS must be hostnames separated by commas or a JSON array.",
    );
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port,
      strictPort: true,
      allowedHosts,
      proxy: { "/api": { target, changeOrigin: true } },
    },
    preview: { port, strictPort: true, allowedHosts },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-dom/client"],
            motion: ["framer-motion"],
            forms: ["zod", "react-hook-form", "@hookform/resolvers/zod"],
          },
        },
      },
    },
  };
});
