import { nativeText } from '../../../i18n/native-text';
import { localizeServerError } from '../../../lib/server-error-localization';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { useRegisterModuleSettingsPage } from "../../../components/server/module-settings-pages";
/**
 * cron-dialogs — diálogos del módulo Cron extraídos de CronScreen sin cambio de
 * comportamiento: crear/editar tarea cron, crear agente IA programado, visor de
 * registros de ejecución, contraseña sudo del daemon y presets de agentes.
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Field, Checkbox, DialogFooter } from "../../../components/server/Form";
import { pillColors, type PillKind } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { TablerChevronLeft, TablerChevronRight, TablerRefresh } from "../../../features/app/tabler-icons";
import { serverCronApi, callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { TablerX } from "./cron-icons";
import {
  type AgentPresets,
  type AgentRulePreset,
  type AgentTagPreset,
  type CronJob,
  type CronRun,
  GUARDS,
  PROVIDERS,
} from "./cron-types";

// ── Diálogo crear/editar tarea cron ──────────────────────────────────────────
export function JobDialog({
  panelId,
  token,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  mode: "create" | "edit";
  row?: CronJob;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverCron;
  const [schedule, setSchedule] = useState(row?.schedule ?? "");
  const [command, setCommand] = useState(row?.command ?? "");
  const [comment, setComment] = useState(row?.comment ?? "");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const payload = { schedule: schedule.trim(), command: command.trim(), comment: comment.trim() || null, enabled };
    const op = mode === "edit" && row ? () => serverCronApi.updateJob(panelId, token, row.id, payload) : () => serverCronApi.createJob(panelId, token, payload);
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved(mode === "create");
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={mode === "edit" ? t.jobs.titleEdit : t.jobs.titleNew}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.jobs.cancel} onSubmit={submit} submitLabel={mode === "edit" ? t.jobs.save : t.jobs.create} submitting={busy} disabled={!schedule.trim() || !command.trim()} />}
    >
      <Field label={t.jobs.labelSchedule}>
        <Input value={schedule} onChangeText={setSchedule} placeholder={t.jobs.placeholderSchedule} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.jobs.labelCommand} hint={t.jobs.commandHint}>
        <Input value={command} onChangeText={setCommand} placeholder={t.jobs.placeholderCommand} autoCapitalize="none" autoCorrect={false} multiline style={{ minHeight: 56 }} />
      </Field>
      <Field label={t.jobs.labelComment}>
        <Input value={comment} onChangeText={setComment} />
      </Field>
      <Checkbox value={enabled} onChange={setEnabled} label={t.jobs.labelEnabled} />
    </FormDrawer>
  );
}

// ── Diálogo crear agente IA programado ───────────────────────────────────────
export function AgentDialog({
  panelId,
  token,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverCron;
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [providerId, setProviderId] = useState("claude");
  const [prompt, setPrompt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const payload = { name: name.trim(), schedule: schedule.trim(), providerId, prompt: prompt.trim(), enabled };
    const out = await runServerMutation(panelId, token, () => serverCronApi.createAiJob(panelId, token, payload));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? t.toasts.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.agents.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.agents.cancel} onSubmit={submit} submitLabel={t.agents.create} submitting={busy} disabled={!name.trim() || !prompt.trim()} />}
    >
      <Field label={t.agents.labelName}>
        <Input value={name} onChangeText={setName} placeholder={t.agents.placeholderName} />
      </Field>
      <Field label={t.agents.labelSchedule}>
        <Input value={schedule} onChangeText={setSchedule} placeholder={t.agents.placeholderSchedule} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label={t.agents.labelProvider}>
        <Select value={providerId} options={PROVIDERS} onChange={setProviderId} />
      </Field>
      <Field label={t.agents.labelPrompt}>
        <Input value={prompt} onChangeText={setPrompt} placeholder={t.agents.placeholderPrompt} multiline style={{ minHeight: 90 }} />
      </Field>
      <Checkbox value={enabled} onChange={setEnabled} label={t.agents.labelEnabled} />
    </FormDrawer>
  );
}

// ── Diálogo de registros de ejecución (tarea cron o agente IA) ───────────────
export function LogsDialog({
  panelId,
  token,
  kind,
  targetId,
  name,
  onClose,
}: {
  panelId: string;
  token: string;
  kind: "job" | "agent";
  targetId: string;
  name: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverCron;
  // Tareas clásicas → /api/cron/jobs/:id/logs ; agentes IA → /api/cron/ai-jobs/:id/logs.
  const base = kind === "job" ? "jobs" : "ai-jobs";

  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CronRun | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    setRunsError(null);
    const res = await callServerApi(panelId, token, "GET", `/api/cron/${base}/${encodeURIComponent(targetId)}/logs`);
    setLoadingRuns(false);
    if (!res.ok) {
      setRuns([]);
      setRunsError(res.error ?? t.logs.loadError);
      return;
    }
    setRuns(unwrap<CronRun[]>(res) ?? []);
  }, [panelId, token, base, targetId, t.logs.loadError]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const openRun = useCallback(
    async (run: CronRun) => {
      if (!run.file) return;
      setSelected(run);
      setContent(null);
      setContentError(false);
      setLoadingContent(true);
      const res = await callServerApi(
        panelId,
        token,
        "GET",
        `/api/cron/${base}/${encodeURIComponent(targetId)}/logs/${encodeURIComponent(run.file)}`,
      );
      setLoadingContent(false);
      if (!res.ok) {
        setContentError(true);
        return;
      }
      const data = unwrap<{ file?: string; content?: string }>(res);
      setContent(data?.content ?? "");
    },
    [panelId, token, base, targetId],
  );

  const runLabel = (run: CronRun) => {
    if (run.startedAt) {
      const d = new Date(run.startedAt);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    return (run.file ?? "—").replace(/\.log$/, "");
  };

  const Pill = ({ label, kind: pk }: { label: string; kind: PillKind }) => {
    const c = pillColors(tokens, pk);
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11, fontWeight: "500" }}>{label}</Text>
      </View>
    );
  };

  const RunStatus = ({ run }: { run: CronRun }) => {
    if (run.running) return <Pill label={t.logs.running} kind="amber" />;
    if (typeof run.exitCode === "number" && run.exitCode !== 0) return <Pill label={formatMessage(t.logs.exitError, { code: run.exitCode })} kind="danger" />;
    return <Pill label={formatMessage(t.logs.ok, { ms: run.durationMs ?? 0 })} kind="ok" />;
  };

  return (
    <Modal visible onClose={onClose} title={formatMessage(t.logs.titleFor, { name })} language={language} scrollable={false} fillHeight>
      <View style={{ flex: 1, gap: 10 }}>
        {!selected ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.logs.pickRun}</Text>
              <Pressable onPress={() => void loadRuns()} hitSlop={8} style={{ padding: 4 }}>
                <TablerRefresh size={18} color={tokens.textMuted} />
              </Pressable>
            </View>
            {loadingRuns ? (
              <View style={{ paddingVertical: 28, alignItems: "center" }}>
                <ActivityIndicator color={tokens.brand} />
              </View>
            ) : runsError ? (
              <Text style={{ color: tokens.danger, fontSize: 13, paddingVertical: 8 }}>{localizeServerError(runsError)}</Text>
            ) : runs.length === 0 ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13, paddingVertical: 20, textAlign: "center" }}>{t.logs.empty}</Text>
            ) : (
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {runs.map((run, i) => (
                  <Pressable
                    key={run.file ?? String(i)}
                    onPress={() => void openRun(run)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border }}
                  >
                    <Text numberOfLines={1} style={{ color: tokens.textSecondary, fontSize: 13, flex: 1 }}>
                      {runLabel(run)}
                    </Text>
                    <RunStatus run={run} />
                    <TablerChevronRight size={16} color={tokens.textMuted} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  setSelected(null);
                  setContent(null);
                  setContentError(false);
                }}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 4 }}
              >
                <TablerChevronLeft size={18} color={tokens.brand} />
                <Text style={{ color: tokens.brand, fontSize: 13 }}>{t.logs.back}</Text>
              </Pressable>
              <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 12, flex: 1, textAlign: "right" }}>
                {runLabel(selected)}
              </Text>
              <Pressable onPress={() => void openRun(selected)} hitSlop={8} style={{ padding: 4 }}>
                <TablerRefresh size={18} color={tokens.textMuted} />
              </Pressable>
            </View>
            {loadingContent ? (
              <View style={{ paddingVertical: 28, alignItems: "center" }}>
                <ActivityIndicator color={tokens.brand} />
              </View>
            ) : contentError ? (
              <Text style={{ color: tokens.danger, fontSize: 13, paddingVertical: 8 }}>{t.logs.contentError}</Text>
            ) : (
              <ScrollView style={{ flex: 1, borderRadius: 8, backgroundColor: withAlpha(tokens.textMuted, 0.08) }} contentContainerStyle={{ padding: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <Text
                    selectable
                    style={{ color: tokens.textSecondary, fontSize: 11, lineHeight: 16, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
                  >
                    {content && content.length > 0 ? content : t.logs.contentEmpty}
                  </Text>
                </ScrollView>
              </ScrollView>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Diálogo de contraseña sudo (install / activar / desactivar servicio) ─────
/**
 * Aparece cuando una acción del daemon devuelve `SUDO_PASSWORD_REQUIRED`/
 * `SUDO_PASSWORD_INVALID`. El install/service del panel acepta `sudoPassword`,
 * así que reintentamos con lo que el usuario escriba (en el modelo de una sola
 * passphrase de LP suele resolverse solo, pero si la passphrase de login no es
 * la de sudo, hay que pedirla).
 */
export function SudoPasswordModal({
  busy,
  error,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverCron;
  const [pw, setPw] = useState("");

  return (
    <Modal
      visible
      onClose={onClose}
      title={t.sudo.title}
      language={language}
      footer={
        <DialogFooter
          onCancel={onClose}
          cancelLabel={t.sudo.cancel}
          onSubmit={() => onSubmit(pw)}
          submitLabel={t.sudo.submit}
          submitting={busy}
          disabled={!pw.trim()}
        />
      }
    >
      <Text style={{ color: tokens.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>{t.sudo.desc}</Text>
      <Field label={t.sudo.label}>
        <Input value={pw} onChangeText={setPw} placeholder={t.sudo.placeholder} autoCapitalize="none" autoCorrect={false} secureToggle secureTextEntry />
      </Field>
      {error ? <Text style={{ color: tokens.danger, fontSize: 12 }}>{localizeServerError(error)}</Text> : null}
    </Modal>
  );
}

// ── Diálogo de presets de agentes (categorías + etiquetas reutilizables) ─────
/**
 * Lee/edita el documento de presets (`GET/PUT /api/cron/agent-presets`). El PUT
 * REEMPLAZA el documento completo, así que conservamos `rules` (reglas) tal cual
 * llegaron y sólo editamos categorías y etiquetas (listas editables).
 */
export function PresetsDialog({
  panelId,
  token,
  onClose,
  onSaved,
  onError,
  embedded = false,
}: {
  embedded?: boolean;
  panelId: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverCron;

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<AgentTagPreset[]>([]);
  // `rules` no se edita aquí; se conserva para no perderlo al reemplazar el doc.
  const [rules, setRules] = useState<AgentRulePreset[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagCat, setNewTagCat] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setLoadErr(null);
      const res = await callServerApi(panelId, token, "GET", "/api/cron/agent-presets");
      if (!alive) return;
      setLoading(false);
      if ((res.code && GUARDS.includes(res.code)) || !res.ok) {
        setLoadErr(t.presets.loadError);
        return;
      }
      const data = unwrap<AgentPresets>(res);
      setCategories(Array.isArray(data?.categories) ? data!.categories.filter((c) => typeof c === "string") : []);
      setTags(
        Array.isArray(data?.tags)
          ? data!.tags
              .map((tg) => (typeof tg === "string" ? { name: tg, category: "" } : { name: tg?.name ?? "", category: tg?.category ?? "" }))
              .filter((tg) => tg.name)
          : [],
      );
      setRules(Array.isArray(data?.rules) ? data!.rules : []);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token, t.presets.loadError]);

  const addCategory = () => {
    const v = newCat.trim();
    if (!v || categories.includes(v)) {
      setNewCat("");
      return;
    }
    setCategories((prev) => [...prev, v]);
    if (!newTagCat) setNewTagCat(v);
    setNewCat("");
  };

  const removeCategory = (c: string) => {
    setCategories((prev) => prev.filter((x) => x !== c));
    setTags((prev) => prev.filter((tg) => tg.category !== c));
    if (newTagCat === c) setNewTagCat("");
  };

  const addTag = () => {
    const name = newTagName.trim();
    const category = newTagCat;
    if (!name || !category) return;
    if (tags.some((tg) => tg.name === name && tg.category === category)) {
      setNewTagName("");
      return;
    }
    setTags((prev) => [...prev, { name, category }]);
    setNewTagName("");
  };

  const removeTag = (idx: number) => setTags((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true);
    const payload = {
      categories: [...new Set(categories.map((c) => c.trim()).filter(Boolean))],
      tags: tags
        .filter((tg) => tg.name.trim() && tg.category.trim())
        .map((tg) => ({ name: tg.name.trim(), category: tg.category.trim() })),
      rules: rules
        .filter((r) => r.title?.trim() && r.text?.trim())
        .map((r) => ({ ...(r.id ? { id: r.id } : {}), title: r.title as string, text: r.text as string })),
    };
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", "/api/cron/agent-presets", payload));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  const chipStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: withAlpha(tokens.brand, 0.12),
    borderColor: withAlpha(tokens.brand, 0.3),
  };

  const footer = <Button label={t.presets.save} onPress={save} loading={busy} disabled={loading || !!loadErr} />;
  const categoriesContent = <View style={{gap:14}}>      {loading ? (
        <View style={{ paddingVertical: 28, alignItems: "center" }}>
          <ActivityIndicator color={tokens.brand} />
        </View>
      ) : loadErr ? (
        <Text style={{ color: tokens.danger, fontSize: 13, paddingVertical: 8 }}>{loadErr}</Text>
      ) : (
        <>
          <Text style={{ color: tokens.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 }}>{t.presets.hint}</Text>

          <Field label={t.presets.categories}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {categories.length === 0 ? (
                <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.presets.emptyCategories}</Text>
              ) : (
                categories.map((c) => (
                  <View key={c} style={chipStyle}>
                    <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{c}</Text>
                    <Pressable onPress={() => removeCategory(c)} hitSlop={6}>
                      <TablerX size={13} color={tokens.textMuted} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Input value={newCat} onChangeText={setNewCat} placeholder={t.presets.newCategory} autoCapitalize="none" autoCorrect={false} onSubmitEditing={addCategory} />
              </View>
              <Button label={t.presets.add} size="sm" variant="secondary" onPress={addCategory} disabled={!newCat.trim()} />
            </View>
          </Field>

          <Field label={t.presets.tags}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {tags.length === 0 ? (
                <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.presets.emptyTags}</Text>
              ) : (
                tags.map((tg, i) => (
                  <View key={`${tg.category} ${tg.name} ${i}`} style={chipStyle}>
                    <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{tg.category ? `${tg.category} · ${tg.name}` : tg.name}</Text>
                    <Pressable onPress={() => removeTag(i)} hitSlop={6}>
                      <TablerX size={13} color={tokens.textMuted} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
            {categories.length === 0 ? (
              <Text style={{ color: tokens.textMuted, fontSize: 12, marginTop: 8 }}>{t.presets.needCategory}</Text>
            ) : (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Select value={newTagCat} options={categories.map((c) => ({ value: c, label: c }))} placeholder={t.presets.selectCategory} onChange={setNewTagCat} />
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input value={newTagName} onChangeText={setNewTagName} placeholder={t.presets.newTag} autoCapitalize="none" autoCorrect={false} onSubmitEditing={addTag} />
                  </View>
                  <Button label={t.presets.add} size="sm" variant="secondary" onPress={addTag} disabled={!newTagName.trim() || !newTagCat} />
                </View>
              </View>
            )}
          </Field>


        </>
      )}
{footer}</View>;
  const rulesContent = <View style={{gap:14}}>{loadErr ? <Text style={{color:tokens.danger}}>{loadErr}</Text> : null}{rules.map((rule,index)=><View key={rule.id ?? index} style={{gap:8}}><Field label={nativeText("Título")}><Input value={rule.title ?? ""} onChangeText={title=>setRules(current=>current.map((item,i)=>i===index?{...item,title}:item))}/></Field><Field label={nativeText("Regla")}><Input value={rule.text ?? ""} multiline onChangeText={text=>setRules(current=>current.map((item,i)=>i===index?{...item,text}:item))}/></Field><Button label={nativeText("Eliminar regla")} variant="ghost" onPress={()=>setRules(current=>current.filter((_,i)=>i!==index))}/></View>)}<Button label={nativeText("Añadir regla")} variant="secondary" onPress={()=>setRules(current=>[...current,{title:"",text:""}])}/>{footer}</View>;
  useRegisterModuleSettingsPage({key:"cats",get label() { return nativeText("Categorías y etiquetas"); },content:categoriesContent});
  useRegisterModuleSettingsPage({key:"rules",get label() { return nativeText("Reglas"); },content:rulesContent});
  if (embedded) return null;
  return <FormDrawer visible onClose={onClose} title={t.presets.title} language={language}>{categoriesContent}{rulesContent}</FormDrawer>;
}
