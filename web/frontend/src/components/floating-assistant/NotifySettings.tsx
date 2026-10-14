// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Preferencias de notificaciones del asistente por servidor. v1: un solo
 * interruptor — avisar en los dispositivos del dueño (web/app/desktop) cuando
 * un chat del asistente termina y NO estabas mirándolo. La campana del panel se
 * mantiene como historial; este toggle controla el push a dispositivos.
 *
 * Vive en Proveedores → «Todos» (General), con el mismo header que sus hermanos.
 */
import { useEffect, useState } from "react";
import { TOGGLE_SWITCH } from "@/lib/ui-classes";
import { notifyPrefsApi } from "./assistant-api";
import { CollapsibleSection } from "./CollapsibleSection";
import { useAssistantI18n } from "./i18n";

export function NotifySettings() {
  const t = useAssistantI18n().notifySettings;
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    notifyPrefsApi
      .get()
      .then((v) => { if (!cancelled) setEnabled(v); })
      .catch((e) => { if (!cancelled) setErr((e as Error).message); });
    return () => { cancelled = true; };
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setErr(null);
    const prev = enabled;
    setEnabled(next); // optimistic
    try {
      setEnabled(await notifyPrefsApi.set(next));
    } catch (e) {
      setEnabled(prev ?? null);
      setErr((e as Error).message || t.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleSection
      icon={<i className="ti ti-bell text-lg" aria-hidden></i>}
      title={t.title}
      description={t.description}
      headerAction={
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={enabled ?? true}
            disabled={busy || enabled === null}
            onChange={(e) => void toggle(e.currentTarget.checked)}
          />
          <span className={`${TOGGLE_SWITCH} peer-disabled:opacity-50`}></span>
        </label>
      }
    >
      {err && <p className="text-xs text-amber-500">{err}</p>}
    </CollapsibleSection>
  );
}
