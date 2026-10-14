import { defineConfig } from "vitest/config";

// Config de tests del cliente desktop (Electron + React + Vite).
// Entorno jsdom para disponer de localStorage / DOM en tests de lógica y
// (más adelante) de componentes con @testing-library/react.
export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.{ts,tsx}", "src/main.tsx"],
    },
  },
});
