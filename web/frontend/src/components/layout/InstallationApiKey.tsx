import { useEffect, useRef, useState, type FormEvent } from "react";
import { getCsrfToken } from "@/lib/api-client";

type KeyStatus = "valid" | "missing" | "invalid" | "unavailable";
type KeyResponse = { ok?: boolean; data?: { configured: boolean; status: KeyStatus }; error?: string };
const ENDPOINT = "/api/admin/installation-api-key";

async function requestStatus(): Promise<KeyStatus> {
  const response = await fetch(ENDPOINT, { credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null) as KeyResponse | null;
  if (!response.ok || !body?.ok || !body.data) throw new Error(body?.error || "No se pudo consultar la API KEY.");
  return body.data.status;
}

export default function InstallationApiKey() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => void requestStatus().then(value => { if (active) setStatus(value); }).catch(() => { if (active) setStatus(null); });
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const close = () => {
    dialog.current?.close();
    setOpen(false);
    setKey("");
    setError("");
  };
  const show = () => {
    setError("");
    setOpen(true);
    dialog.current?.showModal();
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(ENDPOINT, {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ key: key.trim() }),
      });
      const body = await response.json().catch(() => null) as KeyResponse | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error || "No se pudo guardar la API KEY.");
      close();
      setStatus("valid");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la API KEY.");
    } finally {
      setBusy(false);
    }
  };

  const needsKey = status === "missing" || status === "invalid";
  if (!needsKey && !open) return null;
  return <div data-hide-in-desktop className="shrink-0">
    {needsKey && <button type="button" onClick={show} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-300" aria-label="Configurar API KEY de LUXIPANEL" title="Configurar API KEY de LUXIPANEL">
      <i className="ti ti-key text-base" aria-hidden="true" />
      <span className="hidden sm:inline">API KEY</span>
    </button>}
    <dialog ref={dialog} onClose={() => { setOpen(false); setKey(""); setError(""); }} className="w-full max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div><h2 className="text-base font-semibold">API KEY de LUXIPANEL</h2><p className="mt-1 text-xs text-muted-foreground">Activa módulos dev, comunidad, actualizaciones Git y soporte.</p></div>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cerrar"><i className="ti ti-x text-lg" aria-hidden="true" /></button>
      </div>
      <form onSubmit={event => void submit(event)} className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">Genera la clave para este servidor en <a href="https://luxipanel.com/portal/servers" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">luxipanel.com → Servidores → Seguridad → API KEY</a> y pégala aquí.</p>
        <label htmlFor="installation-api-key-input" className="block text-sm font-medium">API KEY</label>
        <input id="installation-api-key-input" type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} required placeholder="lxp_live_…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={close} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">Cancelar</button><button type="submit" disabled={busy || !key.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Validando…" : "Guardar API KEY"}</button></div>
      </form>
    </dialog>
  </div>;
}
