// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Paridad de claves entre locales para los message files del asistente IA
// (fase A1): todas las claves (profundas) presentes en TODOS los locales, sin
// strings vacíos, arrays con la misma longitud y placeholders {x} idénticos.
import { describe, expect, it } from "vitest";
import { LOCALES } from "../locales";
import { assistantChat } from "./screens/assistant-chat";
import { assistantDrawer } from "./screens/assistant-drawer";

/** Aplana un objeto de mensajes a rutas "a.b.0" → valor string. */
function flatten(value: unknown, prefix = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof value === "string") {
    out.set(prefix, value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return out;
  }
  out.set(prefix, String(value));
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const MODULES = { assistantChat, assistantDrawer } as const;

for (const [name, mod] of Object.entries(MODULES)) {
  describe(`paridad i18n — ${name}`, () => {
    const reference = flatten(mod.es);

    it("cubre todos los locales del sistema", () => {
      expect(Object.keys(mod).sort()).toEqual(LOCALES.map((l) => l.code).sort());
    });

    for (const { code } of LOCALES) {
      it(`locale "${code}": mismas claves que es, sin vacíos y placeholders idénticos`, () => {
        const flat = flatten(mod[code]);
        expect([...flat.keys()].sort()).toEqual([...reference.keys()].sort());
        for (const [key, value] of flat) {
          expect(value.trim(), `${name}.${code}.${key} vacío`).not.toBe("");
          expect(placeholders(value), `${name}.${code}.${key} placeholders`).toEqual(
            placeholders(reference.get(key)!),
          );
        }
      });
    }
  });
}
