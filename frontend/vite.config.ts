import { defineConfig, loadEnv } from "vite";
import type { UserConfig, ConfigEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import hawkVitePlugin from "@hawk.so/vite-plugin";

type UserConfigFnObject = (env: ConfigEnv) => UserConfig;

// https://vite.dev/config/
const config: UserConfigFnObject = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      hawkVitePlugin({ token: env.VITE_HAWK_TOKEN }),
    ],
    resolve: {
      alias: {
        "@src": resolve(__dirname, "./src"),
      },
    },
    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
        "Cross-Origin-Embedder-Policy": "unsafe-none",
      },
    },
  };
};

export default defineConfig(config);
