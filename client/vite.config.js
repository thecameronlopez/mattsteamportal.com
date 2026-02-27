import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "portal-logo-512.png",
          "portal-logo-192.png",
          "portal-logo-apple-icon.png",
        ],
        manifest: {
          name: "Matt's Team Portal",
          short_name: "TeamPortal",
          display: "standalone",
          start_url: "/",
          background_color: "#2a2829",
          theme_color: "#262f4c",
          icons: [
            {
              src: "/portal-logo-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/portal-logo-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_SERVER_URL,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
