/* eslint-disable react-hooks/set-state-in-effect -- estado remoto al abrir drawable */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, PlugZap, RefreshCw, Save, Unplug } from "lucide-react";
import { callServerApi, unwrap } from "../../../api/serverApi";
import type { ModuleProps } from "../module-host";

type Field = { key: string; label: string; secret?: boolean; multiline?: boolean };
type Connector = { id: string; name: string; connected: boolean; configured: boolean; lastError: string | null };

const FIELDS: Record<string, Field[]> = {
  "filesystem-mcp": [{ key: "rootPath", label: "Ruta raíz permitida" }],
  "github-mcp": [{ key: "githubToken", label: "Token de GitHub", secret: true }, { key: "owner", label: "Usuario u organización" }],
  "google-drive": [{ key: "GDRIVE_CREDENTIALS", label: "Credenciales OAuth (JSON)", secret: true, multiline: true }],
  onedrive: [{ key: "ONEDRIVE_CLIENT_ID", label: "Client ID" }, { key: "ONEDRIVE_CLIENT_SECRET", label: "Client Secret", secret: true }, { key: "ONEDRIVE_REFRESH_TOKEN", label: "Refresh token", secret: true }],
  dropbox: [{ key: "DROPBOX_ACCESS_TOKEN", label: "Access token", secret: true }],
  notion: [{ key: "NOTION_API_KEY", label: "Integration token", secret: true }],
};

export function McpModule({ serverId, moduleLabel, language, moduleId }: ModuleProps & { moduleId: string }) {
  const es = (language ?? "es").toLowerCase().startsWith("es");
  const office = !["filesystem-mcp", "github-mcp"].includes(moduleId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Connector | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fields = FIELDS[moduleId] ?? [];

  const refresh = useCallback(async () => {
    if (!office) return;
    const res = await callServerApi(serverId, "", "GET", "/api/ai/connectors");
    const row = unwrap<{ connectors: Connector[] }>(res)?.connectors?.find((item) => item.id === moduleId) ?? null;
    setStatus(row);
    if (!res.ok) setMessage(res.error || (es ? "No se pudo leer el estado." : "Could not load status."));
  }, [es, moduleId, office, serverId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage("");
    const path = office ? `/api/ai/connectors/${moduleId}/connect` : `/api/mcp/${moduleId}/install`;
    const body = office ? { secrets: values } : {
      config: Object.fromEntries(fields.filter((field) => !field.secret).map((field) => [field.key, values[field.key]])),
      secrets: Object.fromEntries(fields.filter((field) => field.secret).map((field) => [field.key, values[field.key]])),
    };
    const res = await callServerApi(serverId, "", "POST", path, body);
    setBusy(false);
    setMessage(res.ok ? (es ? "Configuración guardada." : "Configuration saved.") : res.error || (es ? "No se pudo guardar." : "Could not save."));
    if (res.ok) { setValues({}); void refresh(); }
  };

  const action = async (kind: "test" | "disconnect") => {
    if (kind === "disconnect" && !window.confirm(es ? "¿Desconectar y borrar las credenciales guardadas?" : "Disconnect and delete stored credentials?")) return;
    setBusy(true); setMessage("");
    const path = office
      ? `/api/ai/connectors/${moduleId}/disconnect`
      : `/api/mcp/${moduleId}/test-connection`;
    const res = await callServerApi(serverId, "", "POST", path);
    setBusy(false);
    setMessage(res.ok ? (kind === "disconnect" ? (es ? "Desconectado." : "Disconnected.") : (es ? "Conexión correcta." : "Connection successful.")) : res.error || (es ? "La operación falló." : "Action failed."));
    void refresh();
  };

  return <div className="mx-auto max-w-2xl space-y-5 pb-8">
    <div className="flex items-center gap-3"><PlugZap size={22} className="text-primary" /><div><h2 className="text-xl font-semibold">{moduleLabel}</h2><p className="text-sm opacity-60">{es ? "Integración MCP del servidor" : "Server MCP integration"}</p></div></div>
    {office ? <div className="flex items-center justify-between rounded-xl border border-base-300 p-4"><div className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className={status?.connected ? "text-success" : "opacity-40"} />{status?.connected ? (es ? "Conectado" : "Connected") : status?.configured ? (es ? "Configurado, sin conexión" : "Configured, disconnected") : (es ? "Sin configurar" : "Not configured")}</div><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void refresh()} aria-label={es ? "Actualizar estado" : "Refresh status"}><RefreshCw size={15} /></button></div> : null}
    {status?.lastError ? <p role="alert" className="rounded-lg bg-error/10 p-3 text-sm text-error">{status.lastError}</p> : null}
    {message ? <p role="status" className="rounded-lg bg-base-200 p-3 text-sm">{message}</p> : null}
    <form className="space-y-4 rounded-xl border border-base-300 p-5" onSubmit={(event) => void save(event)}>
      <p className="text-xs opacity-60">{es ? "Las credenciales se guardan en el servidor seleccionado. Al guardar, se reemplaza la configuración anterior." : "Credentials are stored on the selected server. Saving replaces the previous configuration."}</p>
      {fields.map((field) => <label key={field.key} className="block text-sm font-medium">{field.label}{field.multiline ? <textarea className="textarea textarea-bordered mt-1 w-full font-mono text-xs" rows={5} required value={values[field.key] ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))} /> : <input className="input input-bordered mt-1 w-full" type={field.secret ? "password" : "text"} autoComplete="off" required value={values[field.key] ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))} />}</label>)}
      <div className="flex flex-wrap gap-2"><button type="submit" className="btn btn-primary btn-sm" disabled={busy}><Save size={15} />{office ? (es ? "Guardar y conectar" : "Save and connect") : (es ? "Guardar" : "Save")}</button>{office ? status?.configured ? <button type="button" className="btn btn-outline btn-sm text-error" disabled={busy} onClick={() => void action("disconnect")}><Unplug size={15} />{es ? "Desconectar" : "Disconnect"}</button> : null : <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void action("test")}><RefreshCw size={15} />{es ? "Probar conexión" : "Test connection"}</button>}</div>
    </form>
  </div>;
}

export const FilesystemMcpModule = (props: ModuleProps) => <McpModule {...props} moduleId="filesystem-mcp" />;
export const GithubMcpModule = (props: ModuleProps) => <McpModule {...props} moduleId="github-mcp" />;
export const GoogleDriveMcpModule = (props: ModuleProps) => <McpModule {...props} moduleId="google-drive" />;
export const OnedriveMcpModule = (props: ModuleProps) => <McpModule {...props} moduleId="onedrive" />;
export const DropboxMcpModule = (props: ModuleProps) => <McpModule {...props} moduleId="dropbox" />;
export const NotionMcpModule = (props: ModuleProps) => <McpModule {...props} moduleId="notion" />;
