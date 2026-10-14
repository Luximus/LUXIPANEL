import { configDefaults, defineConfig } from "vitest/config";

// Tests unitarios del cliente móvil (Expo / React Native).
// Entorno node: cubrimos LÓGICA PURA (sin componentes RN). Los módulos nativos
// de Expo se mockean en test/setup.ts. Los tests de componentes RN (RNTL) se
// añadirán por separado con su propio preset.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [...configDefaults.exclude],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/*.fixtures.ts", "src/**/*.test.{ts,tsx}"],
    },
  },
});
