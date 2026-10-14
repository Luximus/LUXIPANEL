import { localizeServerError } from '../../../lib/server-error-localization';
import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
/**
 * mail-ui — diálogos de cuenta/bandeja del módulo Correo extraídos de
 * `MailScreen.tsx` (espejo del reparto de desktop): editor de listas de
 * direcciones, alta/edición de cuenta, reenvíos por cuenta, detalle de mensaje
 * y redactar/responder. Código movido tal cual; MailScreen los orquesta.
 */
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Field, Checkbox, InfoBox, DialogFooter } from "../../../components/server/Form";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { TablerPlus, TablerTrash } from "../../../features/app/tabler-icons";
import { serverMailApi, callServerApi, unwrap } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import { IconReply } from "./mail-icons";
import { addressEmail, splitEmails, fmtDate } from "./mail-format";
import { normForwards, normFullMessage } from "./mail-normalizers";
import type { MailAccount, MailMessage, FullMessage, ComposeSeed } from "./mail-types";

const enc = encodeURIComponent;

/** Editor inline de una lista de direcciones (whitelist/blacklist/destinos). */
export function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <View style={{ gap: 8 }}>
      {items.map((v, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input value={v} editable={false} />
          </View>
          <Button label="" variant="ghost" size="sm" icon={<TablerTrash size={18} color={tokens.danger} />} onPress={() => onChange(items.filter((_, j) => j !== i))} />
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input value={draft} onChangeText={setDraft} placeholder={placeholder} autoCapitalize="none" keyboardType="email-address" onSubmitEditing={add} />
        </View>
        <Button label={addLabel} variant="secondary" size="sm" icon={<TablerPlus size={16} />} onPress={add} />
      </View>
    </View>
  );
}

export function AccountDialog({
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
  row?: MailAccount;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverMail;
  const isCreate = mode === "create";
  const [address, setAddress] = useState(row?.address ?? "");
  const [password, setPassword] = useState("");
  const [quota, setQuota] = useState((row?.quotaMb ?? row?.quota) != null ? String(row?.quotaMb ?? row?.quota) : "0");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const quotaNum = Number(quota);
    if (!quota.trim() || !Number.isInteger(quotaNum) || quotaNum < 0 || quotaNum > 102400) throw new Error(nativeText("La cuota debe ser un número entero entre 0 y 102400 MB."));
    setBusy(true);
    const op =
      !isCreate && row
        ? () => serverMailApi.updateAccount(panelId, token, String(row.id), { quotaMb: quotaNum, enabled })
        : () => serverMailApi.createAccount(panelId, token, { address: address.trim(), password, quotaMb: quotaNum, enabled });
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={isCreate ? t.dialog.createTitle : t.dialog.editTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.dialog.cancel} onSubmit={submit} submitLabel={isCreate ? t.dialog.create : t.dialog.save} submitting={busy} disabled={isCreate && !address.trim()} />}
    >
      <Field label={t.dialog.labelAddress}>
        <Input value={address} onChangeText={setAddress} editable={isCreate} placeholder={t.dialog.placeholderAddress} autoCapitalize="none" keyboardType="email-address" />
      </Field>
      {isCreate ? (
        <Field label={t.dialog.labelPassword}>
          <Input value={password} onChangeText={setPassword} secureTextEntry secureToggle placeholder={t.dialog.placeholderPassword} autoCapitalize="none" />
        </Field>
      ) : null}
      <Field label={t.dialog.labelQuota} hint={t.dialog.quotaHint}>
        <Input value={quota} onChangeText={setQuota} keyboardType="number-pad" placeholder="0" />
      </Field>
      <Checkbox value={enabled} onChange={setEnabled} label={t.dialog.labelEnabled} />
    </FormDrawer>
  );
}

export function ForwardsDialog({
  panelId,
  token,
  account,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  account: MailAccount;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverMail;
  const [dests, setDests] = useState<{ destination: string; keepCopy: boolean }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false); setLoadError(null); setDests([]);
    void (async () => {
      try {
        const res = await serverMailApi.listForwards(panelId, token, String(account.id));
        if (!alive) return;
        if (!res.ok) throw new Error(res.error ?? getMessages(language).common.error);
        const raw = unwrap<unknown>(res);
        const rows = Array.isArray(raw) ? raw : (raw as {forwards?: unknown[]})?.forwards ?? [];
        setDests(rows.flatMap((row) => normForwards([row]).map(destination => ({ destination, keepCopy: typeof row === "object" && row !== null ? (row as {keepCopy?: boolean}).keepCopy !== false : true }))));
        setLoaded(true);
      } catch (cause) { if (alive) setLoadError(cause instanceof Error ? cause.message : getMessages(language).common.error); }
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token, account.id, loadRevision, language]);

  const submit = async () => {
    if (!loaded) return;
    setBusy(true);
    const forwards = dests.map((d) => ({...d, destination: d.destination.trim()})).filter(d => d.destination);
    const out = await runServerMutation(panelId, token, () => serverMailApi.setForwards(panelId, token, String(account.id), { forwards }));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={t.forwards.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.forwards.close} onSubmit={submit} submitLabel={t.forwards.save} submitting={busy} disabled={!loaded} />}
    >
      <InfoBox>{`${account.address}\n${t.forwards.intro}`}</InfoBox>
      {loadError ? <InfoBox tone="danger">{localizeServerError(loadError)}</InfoBox> : null}
      {loadError ? <Button label={getMessages(language).common.refresh} onPress={() => setLoadRevision(v => v + 1)} /> : null}
      {loaded && dests.length === 0 ? <Text style={{ color: tokens.textMuted, fontSize: 13, marginBottom: 12 }}>{t.forwards.empty}</Text> : null}
      {dests.map((d, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              value={d.destination}
              onChangeText={(v) => setDests((prev) => prev.map((x, j) => (j === i ? { ...x, destination: v } : x)))}
              placeholder={t.forwards.placeholder}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <Button label="" variant="ghost" size="sm" icon={<TablerTrash size={18} color={tokens.danger} />} onPress={() => setDests((prev) => prev.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Button label={t.forwards.add} disabled={!loaded} variant="secondary" size="sm" icon={<TablerPlus size={16} />} onPress={() => setDests((prev) => [...prev, { destination: "", keepCopy: true }])} />
    </FormDrawer>
  );
}

/** Detalle de un mensaje (abre por uid vía `fetchMessage`): from/asunto/fecha/cuerpo. */
export function MessageDialog({
  panelId,
  token,
  accountId,
  folder,
  message,
  onClose,
  onReply,
}: {
  panelId: string;
  token: string;
  accountId: string;
  folder: string;
  message: MailMessage;
  onClose: () => void;
  onReply: (seed: ComposeSeed) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverMail;
  const [full, setFull] = useState<FullMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await callServerApi(panelId, token, "GET", `/api/mail/${enc(accountId)}/messages/${enc(message.uid)}?folder=${enc(folder)}`);
      if (!alive) return;
      const data = unwrap<Record<string, unknown>>(res);
      if (!res.ok || !data) {
        setError(true);
        setLoading(false);
        return;
      }
      setFull(normFullMessage(data));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [panelId, token, accountId, folder, message.uid]);

  const fromText = full?.from || message.from;
  const subjectText = (full?.subject || message.subject || "").trim() || t.detail.noSubject;
  const dateText = fmtDate(full?.date || message.date);

  const replySeed = (): ComposeSeed => {
    const subj = (full?.subject || message.subject || "").trim();
    return {
      to: addressEmail(fromText),
      subject: subj && /^re:/i.test(subj) ? subj : `${t.detail.replyPrefix} ${subj}`.trim(),
    };
  };

  const metaRow = (label: string, value: string) => (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600", width: 56 }}>{label}</Text>
      <Text selectable style={{ color: tokens.textSecondary, fontSize: 13, flex: 1 }}>{value || "—"}</Text>
    </View>
  );

  return (
    <Modal
      visible
      onClose={onClose}
      title={t.detail.title}
      language={language}
      footer={
        <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
          <Button label={t.detail.close} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label={t.detail.reply} icon={<IconReply size={16} />} onPress={() => onReply(replySeed())} disabled={loading || error} style={{ flex: 1 }} />
        </View>
      }
    >
      {loading ? (
        <View style={{ paddingVertical: 28 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ height: 12, width: `${85 - i * 12}%`, borderRadius: 6, backgroundColor: withAlpha(tokens.textMuted, 0.18), marginVertical: 6 }} />
          ))}
        </View>
      ) : error ? (
        <InfoBox tone="danger">{t.detail.loadError}</InfoBox>
      ) : (
        <View>
          <Text style={{ color: tokens.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 10 }}>{subjectText}</Text>
          {metaRow(t.detail.from, fromText)}
          {full?.to ? metaRow(t.detail.to, full.to) : null}
          {metaRow(t.detail.date, dateText)}
          {full && full.attachments > 0 ? (
            <Text style={{ color: tokens.textMuted, fontSize: 12, marginBottom: 6 }}>{formatMessage(t.detail.attachments, { count: full.attachments })}</Text>
          ) : null}
          <View style={{ height: 1, backgroundColor: tokens.border, marginVertical: 10 }} />
          <Text selectable style={{ color: tokens.textSecondary, fontSize: 14, lineHeight: 21 }}>
            {full?.body ? full.body : t.detail.emptyBody}
          </Text>
        </View>
      )}
    </Modal>
  );
}

/** Redactar/Responder: para, asunto, mensaje (+ cc opcional) → `send`. */
export function ComposeDialog({
  panelId,
  token,
  accounts,
  seed,
  onClose,
  onSent,
  onError,
}: {
  panelId: string;
  token: string;
  accounts: MailAccount[];
  seed: ComposeSeed;
  onClose: () => void;
  onSent: () => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const t = getMessages(language).serverMail;
  const [fromId, setFromId] = useState(seed.fromId ?? (accounts[0] ? String(accounts[0].id) : ""));
  const [to, setTo] = useState(seed.to ?? "");
  const [cc, setCc] = useState(seed.cc ?? "");
  const [showCc, setShowCc] = useState(!!seed.cc);
  const [subject, setSubject] = useState(seed.subject ?? "");
  const [body, setBody] = useState(seed.body ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const toList = splitEmails(to);
    if (!toList.length) {
      throw new Error(t.compose.errNoTo);
    }
    const ccList = splitEmails(cc);
    setBusy(true);
    const payload = {
      to: toList,
      subject: subject.trim(),
      text: body,
      ...(ccList.length ? { cc: ccList } : {}),
    };
    const out = await runServerMutation(panelId, token, () => serverMailApi.send(panelId, token, fromId, payload));
    setBusy(false);
    if (out.ok) onSent();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  const fromOptions = accounts.map((a) => ({ value: String(a.id), label: a.address }));

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={seed.subject ? t.compose.replyTitle : t.compose.title}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={t.compose.cancel} onSubmit={submit} submitLabel={t.compose.send} submitting={busy} disabled={!fromId || !to.trim()} />}
    >
      <Field label={t.compose.labelFrom}>
        {fromOptions.length > 1 ? (
          <Select value={fromId} options={fromOptions} onChange={setFromId} />
        ) : (
          <Input value={fromOptions[0]?.label ?? ""} editable={false} />
        )}
      </Field>
      <Field label={t.compose.labelTo} hint={t.compose.hintTo}>
        <Input value={to} onChangeText={setTo} placeholder={t.compose.placeholderTo} autoCapitalize="none" keyboardType="email-address" />
      </Field>
      {showCc ? (
        <Field label={t.compose.labelCc}>
          <Input value={cc} onChangeText={setCc} placeholder={t.compose.placeholderTo} autoCapitalize="none" keyboardType="email-address" />
        </Field>
      ) : (
        <Button label={t.compose.toggleCc} variant="ghost" size="sm" icon={<TablerPlus size={16} />} onPress={() => setShowCc(true)} style={{ alignSelf: "flex-start", marginBottom: 10 }} />
      )}
      <Field label={t.compose.labelSubject}>
        <Input value={subject} onChangeText={setSubject} placeholder={t.compose.placeholderSubject} />
      </Field>
      <Field label={t.compose.labelBody}>
        <Input value={body} onChangeText={setBody} multiline style={{ minHeight: 120 }} placeholder={t.compose.placeholderBody} />
      </Field>
    </FormDrawer>
  );
}
