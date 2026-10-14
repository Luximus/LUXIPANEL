import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, Loader2, Server } from "lucide-react";
import { loginStandalone, normalizeBaseUrl, redeemPanelHandoff, verifyStandaloneTotp, type DirectSession } from "../api/directAuth";
import type { ThemeMode } from "../features/app/types";
import type { StandaloneServer } from "../lib/standalone-servers";
import { StandaloneServerScreen } from "./StandaloneServerScreen";

/** Server view for a portal connection. It redeems SSO without loading panel HTML. */
export function SshScreen({
  theme,
  sshUrl,
  panelId,
  panelName,
  tabId,
  language,
  onConnected,
  onBack,
}: {
  theme: ThemeMode;
  sshUrl: string;
  panelId: string;
  panelName: string;
  tabId: string;
  language?: string;
  onConnected?: () => void;
  onBack: () => void;
}) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const [session, setSession] = useState<DirectSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [partial, setPartial] = useState<DirectSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connectedRef = useRef(onConnected);
  useEffect(() => { connectedRef.current = onConnected; }, [onConnected]);
  const baseUrl = useMemo(() => {
    try { return new URL(sshUrl).origin; }
    catch { return normalizeBaseUrl(sshUrl); }
  }, [sshUrl]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al cambiar de servidor/ticket
    setSession(null);
    setPartial(null);
    setError("");
    setLoading(true);
    if (!sshUrl) { setLoading(false); return; }
    void (async () => {
      try {
        const redeemed = await redeemPanelHandoff(sshUrl);
        if (!cancelled && redeemed) {
          setSession(redeemed.session);
          connectedRef.current?.();
        }
      } catch {
        // Expired tickets and older panels use the native login form below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sshUrl]);

  const server = useMemo<StandaloneServer>(() => ({
    id: `managed:${tabId}:${panelId}`,
    name: panelName || baseUrl,
    baseUrl,
    username,
    savePassword: false,
  }), [baseUrl, panelId, panelName, tabId, username]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!baseUrl || busy) return;
    setBusy(true);
    setError("");
    try {
      if (partial) {
        const result = await verifyStandaloneTotp(baseUrl, partial, code.trim());
        if (result.status === "ok") {
          setSession(result.session);
          setPassword("");
          connectedRef.current?.();
        } else setError(result.message);
      } else {
        const result = await loginStandalone(baseUrl, username.trim(), password);
        if (result.status === "ok") {
          setSession(result.session);
          setPassword("");
          connectedRef.current?.();
        } else if (result.status === "mfa") {
          setPartial(result.partial);
          setPassword("");
        } else setError(result.message);
      }
    } catch {
      setError(es ? "No se pudo conectar con este servidor." : "Could not connect to this server.");
    } finally { setBusy(false); }
  };

  if (session) return <StandaloneServerScreen server={server} session={session} theme={theme} language={language} onBack={onBack} />;

  return (
    <div data-theme={theme} className="flex h-full w-full items-center justify-center bg-base-200 p-6 text-base-content">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 shadow-xl">
        <button type="button" className="btn btn-ghost btn-sm mb-5 gap-2" onClick={onBack}><ArrowLeft size={16} />{es ? "Servidores" : "Servers"}</button>
        <div className="mb-5 flex items-center gap-3"><Server className="text-primary" size={24} /><div className="min-w-0"><h1 className="truncate text-lg font-bold">{panelName}</h1><p className="truncate text-xs opacity-65">{baseUrl}</p></div></div>
        {loading ? <div className="flex items-center gap-2 py-8 text-sm"><Loader2 className="animate-spin" size={18} />{es ? "Conectando…" : "Connecting…"}</div> : (
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
            <p className="text-sm opacity-75">{partial ? (es ? "Introduce el código de verificación del servidor." : "Enter the server verification code.") : (es ? "Inicia sesión en este servidor para abrir sus módulos locales." : "Sign in to this server to open its local modules.")}</p>
            {!partial ? <><label className="form-control"><span className="label-text mb-1 text-sm">{es ? "Usuario Linux" : "Linux user"}</span><input className="input input-bordered w-full" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className="form-control"><span className="label-text mb-1 text-sm">{es ? "Contraseña" : "Password"}</span><input className="input input-bordered w-full" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label></> : <label className="form-control"><span className="label-text mb-1 text-sm">{es ? "Código 2FA" : "2FA code"}</span><input className="input input-bordered w-full" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} /></label>}
            {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={busy || !baseUrl}>{busy ? <Loader2 className="animate-spin" size={17} /> : <LockKeyhole size={17} />}{es ? "Entrar" : "Sign in"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
