import { localizeServerError } from '../../lib/server-error-localization';
import { terminalCliCatalog } from "./terminal-cli-catalog";
import { Button } from "../ui/Button";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import { Select } from "../ui/Select";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type CliState = { installed: string[]; active: string; onboardingDone?: boolean };
type Response<T> = { ok?: boolean; data?: T; error?: string };
const CLI_LABELS: Record<string, string> = {
  default: "Bash", opencode: "OpenCode", claude: "Claude CLI", codex: "Codex CLI",
  grok: "Grok CLI", gemini: "Gemini CLI", copilot: "GitHub Copilot",
  cursor: "Cursor CLI", aider: "Aider", qwen: "Qwen Code", continue: "Continue",
  goose: "Goose", crush: "Crush", amp: "Amp", openhands: "OpenHands",
  codebuff: "Codebuff", minimax: "MiniMax",
};

/** Selector del mismo CLI activo del terminal web; solo ofrece binarios hallados en PATH. */
export function TerminalCliSelector({ panelId, token, language, onInstall }: { panelId: string; token: string; language?: string; onInstall?: (command:string)=>void }) {
  const es = (language ?? "es").startsWith("es");
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const [state, setState] = useState<CliState | null>(null);
  const [probe, setProbe] = useState<Record<string, boolean>>({});
  const [installPage,setInstallPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectionRevision = useRef(0);

  useEffect(() => {
    let current = true;
    const revision = selectionRevision.current;
    void Promise.all([
      luxAssistantProxy<Response<CliState>>(panelId, token, "GET", "/api/terminal-cli/state"),
      luxAssistantProxy<Response<Record<string, boolean>>>(panelId, token, "GET", "/api/terminal-cli/probe"),
    ]).then(async ([saved, found]) => {
      if (!current) return;
      if (saved?.data) setState(saved.data);
      if (found?.data) setProbe(found.data);
      if (!saved?.data) setError(es ? "No se pudo cargar el CLI activo." : "Could not load the active CLI.");
      if (!saved?.data || selectionRevision.current !== revision) return;
      // La web cierra el onboarding antiguo en silencio y vuelve a Bash si el
      // CLI persistido ya no existe en PATH. Mantener la misma regla por box.
      if (saved.data.onboardingDone === false) {
        const skipped = await luxAssistantProxy<Response<CliState>>(panelId, token, "POST", "/api/terminal-cli/onboarding/skip", {});
        if (current && selectionRevision.current === revision && skipped?.data) setState(skipped.data);
      }
      if (saved.data.active !== "default" && found?.data?.[saved.data.active] === false && current && selectionRevision.current === revision) {
        const fallback = await luxAssistantProxy<Response<CliState>>(panelId, token, "POST", "/api/terminal-cli/active", { cliId: "default" });
        if (current && selectionRevision.current === revision && fallback?.data) setState(fallback.data);
      }
    });
    return () => { current = false; };
  }, [panelId, token, es]);

  const select = async (id: string) => {
    if (!state || busy || state.active === id) return;
    selectionRevision.current++;
    setBusy(true);
    setError("");
    try {
      let installed = state.installed;
      if (id !== "default" && !installed.includes(id)) {
        const registered = await luxAssistantProxy<Response<CliState>>(panelId, token, "POST", "/api/terminal-cli/installed", { cliId: id, installed: true });
        if (!registered?.data || registered.ok === false) throw new Error(registered?.error ?? "CLI unavailable");
        installed = registered.data.installed;
      }
      const saved = await luxAssistantProxy<Response<CliState>>(panelId, token, "POST", "/api/terminal-cli/active", { cliId: id });
      if (!saved?.data || saved.ok === false) throw new Error(saved?.error ?? "CLI unavailable");
      setState({ ...saved.data, installed });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const available = terminalCliCatalog.filter(cli=>cli.id === "default" || probe[cli.id!] === true);
  const installable = terminalCliCatalog.filter(cli=>cli.installCommand && probe[cli.id!] !== true);
  return <><View testID="terminal-cli-settings" style={{ gap: 10, padding: 16, borderWidth: 1, borderRadius: 12, borderColor: tokens.border }}>
    <Text style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "700" }}>{es ? "Tema consola" : "Console theme"}</Text>
    <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{es ? "CLI activo" : "Active CLI"}</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger, fontSize: 12 }}>{localizeServerError(error)}</Text> : null}
    {!state ? <ActivityIndicator color={tokens.brand} /> : <Select value={state.active} options={available.map(cli => ({ value: cli.id!, label: cli.label! }))} onChange={id => void select(id)} />}
    <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{es ? "El cambio se aplica al abrir una terminal nueva." : "The change applies to new terminal sessions."}</Text>
  </View>
  {onInstall && installable.length ? <View testID="terminal-install-settings" style={{gap:12,padding:16,borderWidth:1,borderRadius:12,borderColor:tokens.border}}>
    <Text style={{color:tokens.textPrimary,fontWeight:"700"}}>{es?"CLIs disponibles para instalar":"CLIs available to install"}</Text>
    <Text style={{color:tokens.textMuted,fontSize:12}}>{es?"Al instalar, el comando se inyecta en la terminal activa.":"The install command runs in the active terminal."}</Text>
    {installable.slice(installPage*5,installPage*5+5).map(cli=><View key={cli.id} style={{gap:6,padding:12,borderWidth:1,borderColor:tokens.border,borderRadius:8}}>
      <Text style={{color:tokens.textPrimary,fontWeight:"600"}}>{cli.label}</Text><Text style={{color:tokens.textMuted,fontSize:12}}>{cli.description}</Text>
      <Text selectable style={{color:tokens.textSecondary,fontFamily:"monospace",fontSize:11}}>{cli.installCommand}</Text>
      <Button label={es?"Instalar":"Install"} size="sm" variant="secondary" onPress={()=>onInstall(cli.installCommand!)}/>
    </View>)}
    <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
      <Button label={es?"Anterior":"Previous"} size="sm" variant="ghost" disabled={installPage===0} onPress={()=>setInstallPage(p=>p-1)}/>
      <Text style={{color:tokens.textMuted}}>{installPage+1} / {Math.ceil(installable.length/5)}</Text>
      <Button label={es?"Siguiente":"Next"} size="sm" variant="ghost" disabled={(installPage+1)*5>=installable.length} onPress={()=>setInstallPage(p=>p+1)}/>
    </View>
  </View>:null}</>;
}
