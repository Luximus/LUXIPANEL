import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { FormDrawer } from "../../ui/FormDrawer";
import { AgentAvatar } from "../agents/AgentAvatar";
import { getDirectSessionRevision, subscribeDirectSessions } from "../../../api/serverApi";
import type { ThemeTokens } from "../../../theme/colors";
import type { AssistantProject, AgentResolvedModule } from "../types";
import { mobileProfilesApi } from "./api";
import { profileCopy, profileStatus } from "./copy";
import { emptyGlobalManifest, type GlobalDraft, type GlobalManifest, type PublishedProfile, type ProfileHistory, type UpdatePreview } from "./types";

export function GlobalProfiles({ panelId, token, locale, mode, projects, modules, tokens, onImported }: {
  panelId: string; token: string; locale: string; mode: "bazaar" | "mine"; projects: AssistantProject[];
  modules: AgentResolvedModule[]; tokens: ThemeTokens; onImported(id: string, projectId: string): void;
}) {
  const api = useMemo(() => mobileProfilesApi(panelId, token), [panelId, token]), t = profileCopy(locale);
  const [rows, setRows] = useState<(GlobalDraft | PublishedProfile)[]>([]), [selected, setSelected] = useState("");
  const [query, setQuery] = useState(""), [draft, setDraft] = useState<GlobalDraft>(), [preview, setPreview] = useState<GlobalDraft | PublishedProfile>();
  const [history, setHistory] = useState<ProfileHistory>(), [publish, setPublish] = useState(false), [version, setVersion] = useState("1.0.0");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [canPublish, setCanPublish] = useState(false);
  const epoch = useRef(0), alive = useRef(true), running = useRef(false), requests = useRef(new Map<string, string>());
  const identity = useRef(getDirectSessionRevision(panelId));
  const current = () => alive.current && identity.current === getDirectSessionRevision(panelId);
  async function load() {
    const e = ++epoch.current; setError("");
    try {
      const data = mode === "bazaar" ? await api.catalog() : await api.list();
      if (!current() || e !== epoch.current) return;
      setRows(Array.isArray(data) ? data : data.profiles); setCanPublish(!Array.isArray(data) && data.capabilities.canPublish);
    } catch (err) { if (current() && e === epoch.current) setError((err as Error).message); }
  }
  useEffect(() => {
    alive.current = true; identity.current = getDirectSessionRevision(panelId);
    const unsubscribe = subscribeDirectSessions(() => { epoch.current++; setRows([]); setDraft(undefined); setPreview(undefined); setHistory(undefined); });
    void load();
    return () => { alive.current = false; epoch.current++; unsubscribe(); };
  }, [panelId, token, mode]);
  async function work(fn: () => Promise<void>) {
    if (!current() || running.current) return;
    running.current = true; setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (err) { if (current()) setError((err as Error).message); }
    finally { running.current = false; if (current()) setBusy(false); }
  }
  async function importRow(row: GlobalDraft | PublishedProfile) {
    if (!selected) return;
    const version = "revision" in row ? `1.0.${row.revision}` : row.version;
    const key = [mode, row.id, version, selected].join(":");
    const requestId = requests.current.get(key) ?? randomUUID(); requests.current.set(key, requestId);
    const agent = await api.import({ source: mode === "mine" ? "local" : "bazaar", id: row.id, version, projectId: selected, requestId });
    if (current()) onImported(agent.id, selected);
  }
  const text = { color: tokens.textPrimary }, muted = { color: tokens.textMuted };
  return <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Text style={[text, { fontSize: 18, fontWeight: "600" }]}>{mode === "bazaar" ? t.bazaar : t.mine}</Text><Text style={muted}>{t.intro}</Text>
      <Input accessibilityLabel={t.search} placeholder={t.search} value={query} onChangeText={setQuery} />
      <Select accessibilityLabel={t.choose} placeholder={t.choose} value={selected} onChange={setSelected} options={projects.map(p => ({ value: p.id, label: p.title }))} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button label={t.retry} disabled={busy} onPress={() => void load()} />{mode === "mine" && <Button label={t.new} disabled={busy} onPress={() => setDraft({ id: randomUUID(), revision: 0, manifest: emptyGlobalManifest() })} />}</View>
      {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger }}>{error}</Text> : null}{notice ? <Text style={text}>{notice}</Text> : null}
      {!rows.length && !error ? <Text style={muted}>{t.empty}</Text> : null}
      {rows.filter(r => [r.manifest.name, r.manifest.specialty, ...r.manifest.technologies].join(" ").toLowerCase().includes(query.toLowerCase())).map(row =>
        <View key={row.id} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 8, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}><AgentAvatar config={row.manifest.avatarConfig} seed={row.id} size={44} tokens={tokens} /><View style={{ flex: 1 }}><Text style={[text, { fontWeight: "600" }]}>{row.manifest.name}</Text><Text style={muted}>{row.manifest.specialty}</Text></View></View>
          <Text style={text}>{row.manifest.description}</Text><Text style={muted}>{row.manifest.technologies.join(" · ")}</Text>
          <Text style={muted}>{"revision" in row ? `r${row.revision}` : `${row.author} · v${row.version}`}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button label={t.preview} onPress={() => { setPreview(row); setPublish(false); }} />
            <Button label={t.import} disabled={busy || !selected} onPress={() => void work(() => importRow(row))} />
            {"revision" in row && <><Button label={t.edit} disabled={busy} onPress={() => setDraft(row)} />
              {canPublish && <><Button label={t.submit} disabled={busy} onPress={() => { setPreview(row); setPublish(true); setVersion("1.0.0"); }} />
                <Button label={t.history} disabled={busy} onPress={() => void work(async () => { const h = await api.history(row.id); if (current()) setHistory(h); })} /></>}</>}
          </View>
        </View>)}
    </ScrollView>
    <FormDrawer visible={!!draft} title={t.mine} language={locale} onClose={() => { if (!busy) setDraft(undefined); }}>
      {draft && <NativeGlobalEditor value={draft.manifest} modules={modules} tokens={tokens} locale={locale} busy={busy} error={error} onSave={manifest => void work(async () => {
        await api.save({ id: draft.id, revision: draft.revision, manifest }); if (!current()) return; setDraft(undefined); setNotice(t.saved); await load();
      })} />}
    </FormDrawer>
    <FormDrawer visible={!!preview} title={t.preview} language={locale} onClose={() => { if (!busy) setPreview(undefined); }}>
      {preview && <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}><Text style={muted}>{t.publishHint}</Text><NativePreview manifest={preview.manifest} locale={locale} tokens={tokens} />
        {publish && "revision" in preview && <><Input label={t.version} value={version} onChangeText={setVersion} />
          <Button label={t.submit} disabled={busy || !/^\d+\.\d+\.\d+$/.test(version)} onPress={() => void work(async () => { await api.publish(preview, version); if (current()) { setPreview(undefined); setNotice(t.sent); } })} /></>}
        {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger }}>{error}</Text> : null}
      </ScrollView>}
    </FormDrawer>
    <FormDrawer visible={!!history} title={t.history} language={locale} onClose={() => { if (!busy) setHistory(undefined); }}>
      {history && <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}><Text style={text}>{profileStatus(history.profile.visibility, locale)}</Text>{history.versions.map(v => <Text key={v.version} style={text}>v{v.version} · {profileStatus(v.status, locale)}</Text>)}{history.events.map((e, i) => <Text key={i} style={text}>{profileStatus(e.action, locale)} · {e.message}</Text>)}
        <Button label={history.profile.visibility === "published" ? t.unpublish : t.republish} disabled={busy || history.profile.visibility === "suspended" || !history.profile.publishedVersion} onPress={() => void work(async () => { await api.visibility(history.profile.id, history.profile.visibility === "published" ? "unpublished" : "published"); const h = await api.history(history.profile.id); if (current()) setHistory(h); })} />
        {error ? <Text style={{ color: tokens.danger }}>{error}</Text> : null}</ScrollView>}
    </FormDrawer>
  </View>;
}
export function NativePreview({ manifest, locale, tokens }: { manifest: GlobalManifest; locale: string; tokens: ThemeTokens }) {
  const t = profileCopy(locale);
  return <View style={{ gap: 12 }}>{(["name", "description", "specialty", "technologies", "knowledge", "systemPrompt", "allowedTools"] as const).map(key =>
    <View key={key}><Text style={{ color: tokens.textPrimary, fontWeight: "600" }}>{t[key]}</Text><Text selectable style={{ color: tokens.textSecondary }}>{Array.isArray(manifest[key]) ? manifest[key].join(", ") || "—" : manifest[key] ?? t.allTools}</Text></View>)}</View>;
}
function NativeGlobalEditor({ value, modules, tokens, locale, busy, error, onSave }: { value: GlobalManifest; modules: AgentResolvedModule[]; tokens: ThemeTokens; locale: string; busy: boolean; error: string; onSave(manifest: GlobalManifest): void }) {
  const t = profileCopy(locale), [draft, setDraft] = useState(value), [tab, setTab] = useState("general"), [technology, setTechnology] = useState(value.technologies.join(", "));
  const names = [...new Set([...modules.flatMap(m => m.tools.map(t => t.name)), ...(draft.allowedTools ?? [])])].sort();
  return <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }} keyboardShouldPersistTaps="handled">
    <Text style={{ color: tokens.textMuted }}>{t.globalHint}</Text>
    <SegmentedControl items={[{ key: "general", label: t.general }, { key: "tools", label: t.tools }]} value={tab} onChange={setTab} />
    {tab === "general" ? <>
      <AgentAvatar config={draft.avatarConfig} seed={draft.name} size={56} tokens={tokens} /><Button label={t.avatar} onPress={() => setDraft({ ...draft, avatarConfig: { seed: randomUUID() } })} />
      {(["name", "description", "specialty", "knowledge", "systemPrompt"] as const).map(key => <Input key={key} label={t[key]} value={draft[key]} onChangeText={text => setDraft({ ...draft, [key]: text })} multiline={key === "knowledge" || key === "systemPrompt" || key === "description"} maxLength={key === "name" ? 120 : key === "description" ? 500 : key === "specialty" ? 200 : key === "knowledge" ? 12000 : 20000} />)}
      <Input label={t.technologies} value={technology} onChangeText={setTechnology} />
    </> : <><Text style={{ color: tokens.textMuted }}>{t.toolHint}</Text><View style={{ flexDirection: "row", alignItems: "center" }}><Switch accessibilityLabel={t.allTools} value={draft.allowedTools === null} onValueChange={all => setDraft({ ...draft, allowedTools: all ? null : [] })} /><Text style={{ color: tokens.textPrimary }}>{t.allTools}</Text></View>
      {draft.allowedTools !== null && names.map(name => <View key={name} style={{ flexDirection: "row", alignItems: "center" }}><Switch accessibilityLabel={name} value={draft.allowedTools!.includes(name)} onValueChange={on => setDraft({ ...draft, allowedTools: on ? [...draft.allowedTools!, name] : draft.allowedTools!.filter(n => n !== name) })} /><Text style={{ flex: 1, color: tokens.textPrimary }}>{name}</Text></View>)}</>}
    {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger }}>{error}</Text> : null}
    <Button label={t.save} disabled={busy || !draft.name.trim()} onPress={() => onSave({ ...draft, technologies: [...new Set(technology.split(",").map(s => s.trim()).filter(Boolean))] })} />
  </ScrollView>;
}
export function NativeProfileUpdate({ panelId, token, agentId, projectId, locale, tokens, onUpdated }: { panelId: string; token: string; agentId: string; projectId: string; locale: string; tokens: ThemeTokens; onUpdated(): void }) {
  const api = useMemo(() => mobileProfilesApi(panelId, token), [panelId, token]), t = profileCopy(locale);
  const [preview, setPreview] = useState<UpdatePreview>(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const alive = useRef(true), running = useRef(false), revision = useRef(getDirectSessionRevision(panelId));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && revision.current === getDirectSessionRevision(panelId);
  async function work(apply: boolean) {
    if (!current() || running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      if (apply && preview) { await api.update(agentId, projectId, preview); if (current()) { setPreview(undefined); onUpdated(); } }
      else { const next = await api.preview(agentId, projectId); if (current()) setPreview(next); }
    } catch (err) { if (current()) setError((err as Error).message); }
    finally { running.current = false; if (current()) setBusy(false); }
  }
  return <View><Button label={t.update} disabled={busy} onPress={() => void work(false)} />{error ? <Text style={{ color: tokens.danger }}>{error}</Text> : null}
    <FormDrawer visible={!!preview} title={t.update} language={locale} onClose={() => { if (!busy) setPreview(undefined); }}>
      {preview && <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}><Text style={{ color: tokens.textPrimary }}>{t.current}: {preview.current.version} → {t.incoming}: {preview.incoming.version}</Text>
        <Text style={{ color: tokens.textSecondary }}>{t.preserved}: {preview.preserved.join(", ") || "—"}</Text>
        {preview.current.hash === preview.incoming.hash && preview.current.version === preview.incoming.version ? <Text style={{ color: tokens.textPrimary }}>{t.upToDate}</Text> : <>
          <Text style={{ color: tokens.textPrimary }}>{t.current}</Text><NativePreview manifest={preview.current.snapshot} locale={locale} tokens={tokens} />
          <Text style={{ color: tokens.textPrimary }}>{t.incoming}</Text><NativePreview manifest={preview.incoming.snapshot} locale={locale} tokens={tokens} />
          <Button label={t.apply} disabled={busy || !!preview.inheritedFrom} onPress={() => void work(true)} /></>}
        {error ? <Text style={{ color: tokens.danger }}>{error}</Text> : null}</ScrollView>}
    </FormDrawer>
  </View>;
}
