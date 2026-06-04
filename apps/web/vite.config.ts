import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

type VitestConfig = {
  test: {
    environment: "jsdom";
    setupFiles: string[];
  };
};

const config = {
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true
  },
  test: {
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest"]
  }
} satisfies UserConfig & VitestConfig;

export default defineConfig(config);
