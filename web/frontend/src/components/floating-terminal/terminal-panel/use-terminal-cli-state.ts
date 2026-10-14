// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLI_REGISTRY,
  isInstallable,
  type CliEntry,
  type CliId,
} from "../cli-registry";
import {
  terminalCliApi,
  type CliInstallProbe,
  type TerminalCliState,
} from "../terminal-cli-api";
import { injectIntoActiveTerminal } from "./helpers";
import { TARGET_SCOPE_SESSION_KEY } from "@/lib/api-client";

type Params = {
  /** Drawer: pide que el drawer se abra (lo usa "Instalar" para revelar la consola). */
  onRequestVisible?: () => void;
};

export type TerminalCliStateHook = {
  cliState: TerminalCliState | null;
  cliProbe: CliInstallProbe | null;
  stateError: string | null;
  installedEntries: CliEntry[];
  availableToInstall: CliEntry[];
  activeCli: CliId;
  handleInstall: (entry: CliEntry) => Promise<void>;
  handleSelectActive: (id: CliId) => Promise<void>;
};

/**
 * Estado del CLI del terminal: carga inicial (state + probe), onboarding
 * silencioso, auto-fallback a "default" si el CLI activo no está en PATH,
 * listas derivadas (instalados / instalables) y los handlers de instalar y de
 * seleccionar CLI activo (con polling del probe tras instalar).
 */
export function useTerminalCliState({ onRequestVisible }: Params): TerminalCliStateHook {
  const [cliState, setCliState] = useState<TerminalCliState | null>(null);
  const [cliProbe, setCliProbe] = useState<CliInstallProbe | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);

  const activeCli: CliId = cliState?.active ?? "default";
  const confirmedState = useRef<TerminalCliState | null>(null);
  const selectionRevision = useRef(0);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(false);

  function enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const next = writes.current.then(work, work);
    writes.current = next.catch(() => {});
    return next;
  }
  function confirm(next: TerminalCliState) {
    confirmedState.current = next;
    setCliState(next);
  }

  // Carga del estado del CLI al montar (= al hacerse visible).
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    (async () => {
      try {
        const [data, probe] = await Promise.all([
          terminalCliApi.getState(),
          terminalCliApi.probe().catch(() => ({} as CliInstallProbe)),
        ]);
        if (cancelled) return;
        if (selectionRevision.current === 0) confirm(data);
        setCliProbe(probe);
        // Si no se hizo onboarding, lo marcamos hecho silenciosamente.
        if (!data.onboardingDone) {
          try {
            const skipped = await enqueueWrite(() => terminalCliApi.skipOnboarding());
            if (!cancelled && selectionRevision.current === 0) confirm(skipped);
          } catch {
            /* no es crítico */
          }
        }
        // Auto-fallback: si el CLI activo persistido no está realmente en PATH,
        // volvemos a "default".
        const effectiveActive = data.active;
        if (selectionRevision.current === 0 && effectiveActive !== "default" && probe[effectiveActive] === false) {
          try {
            const next = await enqueueWrite(async () => {
              if (selectionRevision.current !== 0) return null;
              return terminalCliApi.setActive("default");
            });
            if (!cancelled && selectionRevision.current === 0 && next) confirm(next);
          } catch {
            /* keep prior state */
          }
        }
      } catch (err) {
        if (cancelled) return;
        setStateError((err as Error).message);
        setCliState({
          onboardingDone: true,
          installed: ["default"],
          active: "default",
          updatedAt: new Date(0).toISOString(),
        });
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  // El select debe reflejar lo realmente presente en el servidor conectado —
  // ignoramos el estado persistido y mostramos solo "default" + lo que el probe
  // confirma instalado.
  const installedEntries = useMemo(
    () =>
      CLI_REGISTRY.filter((entry) => {
        if (entry.id === "default") return true;
        return cliProbe?.[entry.id] === true;
      }),
    [cliProbe],
  );

  const availableToInstall = useMemo(
    () =>
      CLI_REGISTRY.filter((entry) => {
        if (!isInstallable(entry)) return false;
        return cliProbe?.[entry.id] !== true;
      }),
    [cliProbe],
  );

  const installPollsRef = useRef<Set<CliId>>(new Set());
  async function pollProbeAfterInstall(cliId: CliId) {
    if (installPollsRef.current.has(cliId)) return;
    installPollsRef.current.add(cliId);
    try {
      const maxAttempts = 30; // ~2 min total (4s * 30)
      for (let i = 0; i < maxAttempts && mounted.current; i++) {
        await new Promise((resolve) => window.setTimeout(resolve, 4000));
        if (!mounted.current) return;
        try {
          const fresh = await terminalCliApi.probe();
          if (!mounted.current) return;
          setCliProbe(fresh);
          if (fresh[cliId] === true) {
            const next = await enqueueWrite(() => terminalCliApi.setInstalled(cliId, true));
            if (!mounted.current) return;
            confirmedState.current = next;
            // Installation metadata must not overwrite a newer startup choice.
            setCliState((current) => current ? { ...next, active: current.active } : next);
            return;
          }
        } catch {
          /* keep retrying */
        }
      }
    } finally {
      installPollsRef.current.delete(cliId);
    }
  }

  async function handleInstall(entry: CliEntry) {
    if (!entry.installCommand) return;
    onRequestVisible?.();
    window.setTimeout(() => injectIntoActiveTerminal(entry.installCommand!), 120);
    setStateError(null);
    void pollProbeAfterInstall(entry.id);
  }

  async function handleSelectActive(id: CliId) {
    const revision = ++selectionRevision.current;
    setStateError(null);
    setCliState((current) => current ? { ...current, active: id } : current);
    try {
      const saving = enqueueWrite(async () => {
        if (revision !== selectionRevision.current) return null;
        // The picker uses PATH discovery; register an existing CLI before the
        // backend checks its persisted installation list during activation.
        if (id !== "default" && !confirmedState.current?.installed.includes(id)) {
          await terminalCliApi.setInstalled(id, true);
        }
        const saved = await terminalCliApi.setActive(id);
        confirmedState.current = saved;
        return saved;
      });
      window.dispatchEvent(new CustomEvent("lxp-terminal:cli-selecting", {
        detail: { scope: sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "local", promise: saving },
      }));
      const next = await saving;
      if (mounted.current && revision === selectionRevision.current && next) setCliState(next);
    } catch (err) {
      if (!mounted.current || revision !== selectionRevision.current) return;
      setCliState(confirmedState.current);
      setStateError((err as Error).message);
    }
  }

  return {
    cliState,
    cliProbe,
    stateError,
    installedEntries,
    availableToInstall,
    activeCli,
    handleInstall,
    handleSelectActive,
  };
}
