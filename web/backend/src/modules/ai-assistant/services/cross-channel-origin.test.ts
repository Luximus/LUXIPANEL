// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Resolución del origen del canal MCP per-run.
 *
 * Lo que de verdad hay que blindar aquí es la DEGRADACIÓN SEGURA: un target
 * remoto jamás puede recibir un `127.0.0.1`, porque ese loopback sería el suyo,
 * no el del panel — el agente hablaría con otra máquina (o con nada). Ante
 * cualquier duda (sonda que falla, sin curl, otro proceso escuchando en el
 * puerto) el resultado correcto es el origen público.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { INSTANCE_ID } from "../../../config/instance.js";
import type { Executor } from "../../../shared/executor/index.js";
import {
  resolveCrossChannelOrigin,
  __crossChannelInternals,
} from "./cross-channel-origin.js";

const PUBLIC = "https://panel.example.org";

/** Executor de mentira: solo nos importa `target.id` y qué contesta `exec`. */
function makeExecutor(targetId: string, stdout: string | Error): Executor {
  return {
    target: { id: targetId, name: targetId },
    exec: vi.fn(async () => {
      if (stdout instanceof Error) throw stdout;
      return { stdout, stderr: "", code: 0 };
    }),
  } as unknown as Executor;
}

/** Respuesta de `/api/health` de ESTE proceso. */
const ourHealth = JSON.stringify({ ok: true, service: "luxipanel", instanceId: INSTANCE_ID });
/** Respuesta de OTRO backend luxipanel escuchando en el 8080 del target. */
const foreignHealth = JSON.stringify({ ok: true, service: "luxipanel", instanceId: "otro-proceso" });

beforeEach(() => {
  __crossChannelInternals.verdicts.clear();
});

describe("resolveCrossChannelOrigin", () => {
  it("usa el loopback cuando el target devuelve NUESTRO instanceId (co-localizado)", async () => {
    const exec = makeExecutor("LXP-SELF", ourHealth);
    await expect(resolveCrossChannelOrigin(exec, PUBLIC)).resolves.toBe(__crossChannelInternals.loopbackOrigin());
  });

  it("usa el loopback para el executor local sin sondear siquiera", async () => {
    const exec = makeExecutor("local", new Error("no debería ejecutarse"));
    await expect(resolveCrossChannelOrigin(exec, PUBLIC)).resolves.toBe(__crossChannelInternals.loopbackOrigin());
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it("SE QUEDA en el origen público si en el 8080 del target responde OTRO backend", async () => {
    // El caso peligroso: hay un luxipanel escuchando ahí, pero no es el nuestro.
    // Comparar IPs o "¿contesta algo?" daría un falso positivo; el nonce no.
    const exec = makeExecutor("LXP-REMOTE", foreignHealth);
    await expect(resolveCrossChannelOrigin(exec, PUBLIC)).resolves.toBe(PUBLIC);
  });

  it("se queda en el origen público si el target no responde (sin curl, sin red, timeout)", async () => {
    const exec = makeExecutor("LXP-REMOTE", new Error("curl: command not found"));
    await expect(resolveCrossChannelOrigin(exec, PUBLIC)).resolves.toBe(PUBLIC);
  });

  it("cachea el veredicto por target: una sonda por sesión, no una por run", async () => {
    const exec = makeExecutor("LXP-SELF", ourHealth);
    await resolveCrossChannelOrigin(exec, PUBLIC);
    await resolveCrossChannelOrigin(exec, PUBLIC);
    await resolveCrossChannelOrigin(exec, PUBLIC);
    expect(exec.exec).toHaveBeenCalledTimes(1);
  });

  it("sin executor devuelve el origen público (no hay dónde sondear)", async () => {
    await expect(resolveCrossChannelOrigin(null, PUBLIC)).resolves.toBe(PUBLIC);
  });
});
