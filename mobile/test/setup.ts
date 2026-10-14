import { vi } from "vitest";
import { createHash } from "node:crypto";

// expo-crypto no existe fuera del runtime nativo. Lo mockeamos con node:crypto
// produciendo EXACTAMENTE el mismo SHA-256 hex que el dispositivo, de modo que
// los tests de paridad del hash canónico (app ↔ backend) son fidedignos.
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { HEX: "hex" },
  digestStringAsync: async (_algo: string, data: string, opts?: { encoding?: string }) =>
    createHash("sha256").update(data, "utf8").digest((opts?.encoding as "hex") ?? "hex"),
}));

// AsyncStorage en memoria para tests de storage que lo usen.
vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
      removeItem: vi.fn(async (k: string) => void store.delete(k)),
      clear: vi.fn(async () => void store.clear()),
    },
  };
});
