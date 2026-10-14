import { useEffect, useRef, useState } from "react";
import { api, unwrap } from "@/lib/api-client";
import { getClientMessages } from "@/i18n/client";
import { useViewContext } from "../view-context";
import { useModuleVisibility } from "../module-visibility";
import { AssistantI18nProvider, mergeAssistantMessages, useAssistantI18n } from "../../floating-assistant/i18n";
import { ProviderCard } from "../../floating-assistant/ProvidersTab";
import { TranslationSettings } from "../../floating-assistant/TranslationSettings";
import { AgentCredentialFields } from "./AgentCredentialFields";
import type { AssistantConfigState, AssistantAgent, AssistantProviderId } from "../../floating-assistant/assistant-api";

const IDS: AssistantProviderId[] = ["claude", "codex", "gemini", "deepseek", "grok", "minimax"];
const changed = () => window.dispatchEvent(new Event("luxipanel:credentials-changed"));

export function AssistantCredentialSettings() {
  const { scope } = useViewContext();
  const visible = useModuleVisibility();
  const [visited, setVisited] = useState(false);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const target = () => { setVisited(false); setGeneration(g => g + 1); };
    window.addEventListener("luxipanel:target-changed", target);
    return () => window.removeEventListener("luxipanel:target-changed", target);
  }, []);
  useEffect(() => {
    if (!visible) return;
    const card = scope.root.querySelector("#cred-card-assistant");
    if (!card) return;
    const check = () => {
      if (card.querySelector('[data-lxp-collapse-toggle]')?.getAttribute("aria-expanded") === "true") setVisited(true);
    };
    const observer = new MutationObserver(check);
    observer.observe(card, { subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    check();
    return () => observer.disconnect();
  }, [scope, visible, generation]);
  return visited ? <AssistantCredentialEditor key={generation} /> : null;
}

function AssistantCredentialEditor() {
  const { locale, messages: pageMessages } = useViewContext();
  const [data, setData] = useState<{ config: AssistantConfigState; messages: ReturnType<typeof mergeAssistantMessages> } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let alive = true;
    setError("");
    void Promise.all([api.get<{config: AssistantConfigState}>("/api/ai/config", { fresh: true }), getClientMessages(locale, ["assistant"])]).then(([res, payload]) => {
      const config = unwrap(res, pageMessages.settings.credentials.error).config;
      if (alive) setData({ config, messages: mergeAssistantMessages(payload.assistant ?? {}) });
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [locale, attempt]);
  if (!data) return <div className="p-4 text-sm" role="status">{error || mergeAssistantMessages({}).providersTab.loading}
    {error && <button type="button" className="ml-2 underline" onClick={() => setAttempt(a => a + 1)}>{pageMessages.settings.loadFailure.retry}</button>}
  </div>;
  return <AssistantI18nProvider value={data.messages}><CredentialSections config={data.config} onChange={config => { if (mounted.current) setData(current => current ? { ...current, config } : current); }} /></AssistantI18nProvider>;
}

function CredentialSections({ config, onChange }: { config: AssistantConfigState; onChange(config: AssistantConfigState): void }) {
  const t = useAssistantI18n();
  const { locale, messages } = useViewContext();
  const [section, setSection] = useState("providers");
  const [provider, setProvider] = useState<AssistantProviderId>(config.activeProvider || "claude");
  const sections = [
    ["providers", t.drawer.tabs.providers],
    ["translation", t.translationSettings.enginesCredentials],
    ["agents", t.agentsTab.editor.credentialTitle],
  ];
  return <div className="space-y-3 p-3" data-ai-credentials>
    <label className="block text-xs"><span>{messages.settings.credentials.title}</span>
      <select aria-label={messages.settings.credentials.title} value={section} onChange={e => setSection(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2">
        {sections.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
    {section === "providers" && <>
      <select aria-label={t.drawer.tabs.providers} value={provider} onChange={e => setProvider(e.target.value as AssistantProviderId)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
        {IDS.map(id => <option key={id} value={id}>{id === "codex" ? "Codex (OpenAI)" : id.charAt(0).toUpperCase() + id.slice(1)}</option>)}
      </select>
      <ProviderCard key={provider} id={provider} state={config.providers[provider]} onPatch={async patch => {
        const res = await api.put<{config: AssistantConfigState}>(`/api/ai/config/providers/${provider}`, patch);
        const next = unwrap(res, messages.settings.credentials.error).config;
        onChange(next); changed();
      }} />
    </>}
    {section === "translation" && <TranslationSettings config={config} locale={locale} credentialsOnly />}
    {section === "agents" && <AgentCredentials />}
  </div>;
}

function AgentCredentials() {
  const t = useAssistantI18n();
  const { messages } = useViewContext();
  const [agents, setAgents] = useState<AssistantAgent[]>([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<any>({ credentialSaved: null, credentialInput: null, credentialClear: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const serial = useRef(0);
  useEffect(() => {
    let alive = true;
    void api.get<{agents: AssistantAgent[]}>("/api/ai/agents").then(res => {
      const data = unwrap(res, messages.settings.credentials.error);
      if (alive) setAgents(data.agents.filter(agent => agent.relation !== "shared"));
    }).catch(e => { if (alive) setNotice(e.message); });
    return () => { alive = false; serial.current++; };
  }, []);
  function select(id: string) {
    serial.current++;
    setSelected(id); setNotice("");
    setDraft({ credentialSaved: agents.find(a => a.id === id)?.credential ?? null, credentialInput: null, credentialClear: false });
  }
  async function save() {
    const version = serial.current;
    setBusy(true); setNotice("");
    try {
      const credential = draft.credentialClear ? null : draft.credentialInput;
      const res = await api.put<{agent: AssistantAgent}>(`/api/ai/agents/${encodeURIComponent(selected)}`, { credential });
      const agent = unwrap(res, messages.settings.credentials.error).agent;
      if (version !== serial.current) return;
      setAgents(all => all.map(a => a.id === agent.id ? agent : a));
      setDraft({ credentialSaved: agent.credential ?? null, credentialInput: null, credentialClear: false });
      setNotice(messages.settings.credentials.saved); changed();
    } catch (e) { if (version === serial.current) setNotice((e as Error).message); }
    finally { if (version === serial.current) setBusy(false); }
  }
  return <div className="space-y-3">
    <select aria-label={t.drawer.tabs.agentes} value={selected} disabled={busy} onChange={e => select(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
      <option value="">{t.drawer.tabs.agentes}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
    {selected && <fieldset disabled={busy} className="space-y-3"><AgentCredentialFields draft={draft} setDraft={setDraft} />
      <button type="button" disabled={busy || (!draft.credentialClear && !(draft.credentialInput?.username.trim() && draft.credentialInput?.secret))} onClick={() => void save()} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50">{t.providersTab.save}</button>
    </fieldset>}
    {notice && <p role="status" className="text-xs break-words">{notice}</p>}
  </div>;
}
