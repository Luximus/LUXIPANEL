import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleTextAlign, getMessages } from "../../i18n";
import { FormSheet } from "../ui/FormSheet";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import {
  aiCollect,
  createRequirement,
  jobsErrorKey,
  listMyServers,
  type AiCollectFields,
  type AiCollectResult,
  type CreateRequirementPayload,
  type JobServer,
  type Requirement,
} from "../../api/jobs";
import { jt, toDateInput, type JobsDict } from "./jobs-i18n";
import { makeStyles } from "./CreateRequirementModal.styles";

const WORK_TYPES = ["fixed", "hourly", "milestone"] as const;

// Crear requerimiento (draft) + asistente IA `aiCollect` (espejo de
// `openCreateModal`/`createRequirement`/`assistCollect`). Al éxito invoca
// `onCreated` para que la pantalla recargue la lista.
export function CreateRequirementModal({
  visible,
  token,
  dict,
  language,
  onClose,
  onCreated,
  notify,
}: {
  visible: boolean;
  token: string;
  dict: JobsDict;
  language: string;
  onClose: () => void;
  onCreated: (created: Requirement) => void;
  notify: (msg: string, variant?: "success" | "error") => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textAlign = getLocaleTextAlign(language);

  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("CO");
  const [reqLanguage, setReqLanguage] = useState(language || "es");
  const [workType, setWorkType] = useState<string>("fixed");
  const [deliverables, setDeliverables] = useState("");
  const [deadline, setDeadline] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [hints, setHints] = useState<AiCollectResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Modalidad "Servidor": método + servidor del cliente.
  const [execMode, setExecMode] = useState<"standard" | "server">("standard");
  const [servers, setServers] = useState<JobServer[]>([]);
  const [clientServerId, setClientServerId] = useState("");

  useEffect(() => {
    if (!visible || execMode !== "server") return;
    let alive = true;
    void listMyServers(token).then((list) => {
      if (!alive) return;
      setServers(list);
      if (list.length) setClientServerId((cur) => cur || list[0].id);
    }).catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [visible, execMode, token]);

  const reset = () => {
    setDraft(""); setTitle(""); setDescription(""); setCountry("CO");
    setReqLanguage(language || "es"); setWorkType("fixed"); setDeliverables("");
    setDeadline(""); setPrice(""); setError(""); setHints(null);
    setExecMode("standard"); setClientServerId("");
  };

  const handleClose = () => {
    if (submitting || assisting) return;
    reset();
    onClose();
  };

  const runAssist = async () => {
    if (!draft.trim()) { setError(jt(dict, "ai.draftPlaceholder")); return; }
    setError("");
    setAssisting(true);
    try {
      const known: Partial<AiCollectFields> = {};
      if (title.trim()) known.title = title.trim();
      if (description.trim()) known.description = description.trim();
      const res = await aiCollect(token, draft.trim(), Object.keys(known).length ? known : undefined, language || "es");
      const f = res.fields;
      if (f.title) setTitle(f.title);
      if (f.description) setDescription(f.description);
      if (f.country) setCountry(f.country);
      if (f.language) setReqLanguage(f.language);
      if (f.workType) setWorkType(f.workType);
      if (Array.isArray(f.deliverables) && f.deliverables.length) setDeliverables(f.deliverables.join("\n"));
      if (f.deadline) setDeadline(toDateInput(f.deadline));
      setHints(res);
      if (res.aiUsed === false) notify(jt(dict, "ai.unavailable"), "error");
    } catch (err) {
      setError(jt(dict, jobsErrorKey(err)));
    } finally {
      setAssisting(false);
    }
  };

  const submit = async () => {
    const t = title.trim();
    const d = description.trim();
    const p = parseInt(price, 10);
    if (t.length < 3) { setError(jt(dict, "field.title")); return; }
    if (!d) { setError(jt(dict, "field.description")); return; }
    if (!Number.isFinite(p) || p <= 0) { setError(jt(dict, "field.price")); return; }
    if (execMode === "server" && !clientServerId) { setError(jt(dict, "server.clientServer")); return; }
    setError("");
    setSubmitting(true);
    try {
      const payload: CreateRequirementPayload = {
        title: t,
        description: d,
        country: (country.trim().toUpperCase() || "CO").slice(0, 2),
        language: reqLanguage.trim() || "es",
        workType: workType.trim() || "fixed",
        deliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
        deadlineAt: deadline.trim() ? new Date(deadline.trim()).toISOString() : null,
        acceptedPrice: p,
        executionMode: execMode,
        clientServerId: execMode === "server" ? clientServerId : null,
      };
      const created = await createRequirement(token, payload);
      notify(jt(dict, "toast.created"), "success");
      reset();
      onCreated(created);
    } catch (err) {
      setError(jt(dict, jobsErrorKey(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      onClose={handleClose}
      title={getMessages(language).common.create}
      language={language}
      footer={
        <View style={styles.footerRow}>
          <Button label={jt(dict, "cancel")} variant="ghost" onPress={handleClose} disabled={submitting || assisting} style={styles.footerBtn} />
          <Button label={jt(dict, "save")} variant="primary" onPress={submit} loading={submitting} style={styles.footerBtn} />
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.aiBox}>
          <Text style={[styles.aiTitle, { color: tokens.brand, textAlign }]}>{jt(dict, "ai.plan")}</Text>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={jt(dict, "ai.draftPlaceholder")}
            multiline
          />
          <Button label={jt(dict, "ai.moderatePlan")} variant="secondary" size="sm" onPress={runAssist} loading={assisting} />
          {hints ? (
            hints.aiUsed === false ? (
              <Text style={[styles.aiNotice, { color: tokens.warning, textAlign }]}>{jt(dict, "ai.unavailable")}</Text>
            ) : (
              <>
                {hints.questions?.length ? (
                  <>
                    <Text style={[styles.aiHeading, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "ai.questions")}</Text>
                    {hints.questions.map((q, i) => (
                      <Text key={i} style={[styles.aiLine, { color: tokens.textSecondary, textAlign }]}>• {q}</Text>
                    ))}
                  </>
                ) : null}
                {hints.missing?.length ? (
                  <>
                    <Text style={[styles.aiHeading, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "ai.missing")}</Text>
                    <View style={styles.chipsRow}>
                      {hints.missing.map((m, i) => (
                        <View key={i} style={styles.chip}>
                          <Text style={[styles.chipText, { color: tokens.textSecondary }]}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            )
          ) : null}
        </View>

        <Input label={jt(dict, "field.title")} value={title} onChangeText={setTitle} maxLength={200} />
        <Input label={jt(dict, "field.description")} value={description} onChangeText={setDescription} multiline maxLength={20000} />
        <Input label={jt(dict, "field.deliverables")} value={deliverables} onChangeText={setDeliverables} multiline />

        <Select
          value={workType}
          onChange={setWorkType}
          options={WORK_TYPES.map((w) => ({ value: w, label: jt(dict, `workType.${w}`) === `workType.${w}` ? w : jt(dict, `workType.${w}`) }))}
        />
        <Input label={jt(dict, "field.country")} value={country} onChangeText={setCountry} maxLength={2} autoCapitalize="characters" />
        <Input label={jt(dict, "field.deadline")} value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" />
        <Input label={jt(dict, "field.price")} value={price} onChangeText={setPrice} keyboardType="number-pad" />

        {/* Modalidad "Servidor" (AI Dev Marketplace) */}
        <Text style={[styles.aiHeading, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "server.mode")}</Text>
        <Select
          value={execMode}
          onChange={(v) => setExecMode(v === "server" ? "server" : "standard")}
          options={[
            { value: "standard", label: jt(dict, "server.mode.standard") },
            { value: "server", label: jt(dict, "server.mode.server") },
          ]}
        />
        {execMode === "server" ? (
          servers.length ? (
            <Select
              value={clientServerId}
              onChange={setClientServerId}
              options={servers.map((s) => ({ value: s.id, label: `${s.name} (${s.hostname})` }))}
            />
          ) : (
            <Text style={[styles.aiNotice, { color: tokens.warning, textAlign }]}>{jt(dict, "server.noServers")}</Text>
          )
        ) : null}

        {error ? <Text style={[styles.error, { color: tokens.danger, textAlign }]}>{error}</Text> : null}
      </View>
    </FormSheet>
  );
}
