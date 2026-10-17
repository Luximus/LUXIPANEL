import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Use threads pool — no native modules (node-pty) in tests
    pool: "threads",
    globals: true,
    environment: "node",
    // Unit tests also import the validated application config. Use an explicit
    // test identity so clean CI does not depend on a private deployment .env.
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "unit-test-".repeat(4),
    },
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/server.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
      },
    },
  },
  resolve: {
    alias: {
      "@config": resolve(__dirname, "./src/config"),
      "@shared": resolve(__dirname, "./src/shared"),
      "@modules": resolve(__dirname, "./src/modules"),
    },
  },
});
