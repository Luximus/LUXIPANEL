import { describe, it, expect, vi } from "vitest";

// `payouts.ts` importa `request` desde `./client`, cuya cadena de imports
// arrastra módulos nativos de Expo (integrity / step-up). Como aquí solo
// probamos `tokensToUsd` (pura, sin red), mockeamos `./client` con un stub para
// no evaluar esa cadena nativa al importar el módulo bajo test.
vi.mock("./client", () => ({ request: vi.fn() }));

import { tokensToUsd } from "./payouts";

// Contrato (espejo EXACTO del backend, documentado en payouts.ts):
//   usd = floor(tokens * rate * 100) / 100
// con guarda: entradas no finitas o no positivas (tokens<=0 || rate<=0) => 0.
describe("tokensToUsd", () => {
  it("aplica floor a 2 decimales (trunca, no redondea)", () => {
    // 100 * 0.10 = 10 exacto.
    expect(tokensToUsd(100, 0.1)).toBe(10);
    // 333 * 0.10 = 33.300000000000004 → floor a centavos = 33.30.
    expect(tokensToUsd(333, 0.1)).toBe(33.3);
  });

  it("trunca centavos sobrantes hacia abajo (nunca redondea al alza)", () => {
    // 1 * 0.999 = 0.999 → floor a centavos = 0.99 (no 1.00).
    expect(tokensToUsd(1, 0.999)).toBe(0.99);
    // 7 * 0.337 = 2.359 → 2.35.
    expect(tokensToUsd(7, 0.337)).toBe(2.35);
  });

  it("soporta tokens fraccionarios", () => {
    // 2.5 * 4 = 10.
    expect(tokensToUsd(2.5, 4)).toBe(10);
  });

  it("devuelve 0 cuando tokens es 0 o negativo", () => {
    expect(tokensToUsd(0, 0.1)).toBe(0);
    expect(tokensToUsd(-5, 0.1)).toBe(0);
  });

  it("devuelve 0 cuando rate es 0 o negativo", () => {
    expect(tokensToUsd(100, 0)).toBe(0);
    expect(tokensToUsd(100, -0.1)).toBe(0);
  });

  it("devuelve 0 ante entradas no finitas (NaN / Infinity)", () => {
    expect(tokensToUsd(Number.NaN, 0.1)).toBe(0);
    expect(tokensToUsd(100, Number.NaN)).toBe(0);
    expect(tokensToUsd(Number.POSITIVE_INFINITY, 0.1)).toBe(0);
    expect(tokensToUsd(100, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("nunca devuelve un valor negativo (las guardas cubren los signos)", () => {
    // Cualquier combinación que produciría un negativo cae en una guarda => 0.
    expect(tokensToUsd(-1, -1)).toBe(0);
  });
});
