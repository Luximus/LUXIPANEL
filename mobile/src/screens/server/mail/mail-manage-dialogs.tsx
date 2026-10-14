import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
/**
 * mail-manage-dialogs — diálogos de la gestión por cuenta del módulo Correo
 * (extraídos verbatim de `mail-manage.tsx`): filtro Sieve, firma, contacto,
 * calendario y carpetas IMAP (crear/renombrar). `FilterDialog` se re-exporta
 * desde `mail-manage.tsx` (lo importa también `mail-settings.tsx` para los
 * filtros globales).
 */
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { getMessages } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { Field, Checkbox, DialogFooter } from "../../../components/server/Form";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { TablerPlus, TablerTrash } from "../../../features/app/tabler-icons";
import { serverMailApi, callServerApi } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import {
  FILTER_PARTS, FILTER_MATCHES, FILTER_ACTIONS, ACTION_NEEDS_VALUE,
} from "./mail-constants";
import { normRules, normActions } from "./mail-normalizers";
import type {
  FilterRule, FilterAction, MailFilter, Signature, MailAccount,
  Contact, ManageFolder, Calendar,
} from "./mail-types";

const enc = encodeURIComponent;

/** Diálogo de filtro Sieve: nombre + condiciones (campo/operador/valor) + acciones. */
export function FilterDialog({
  panelId,
  token,
  accountId,
  mode,
  row,
  onClose,
  onSaved,
  onError,
  customSubmit,
}: {
  panelId: string;
  token: string;
  accountId: string;
  mode: "create" | "edit";
  row?: MailFilter;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
  /** Si se provee, sustituye la mutación por defecto (cuenta) — p.ej. filtros globales. */
  customSubmit?: (payload: { name: string; enabled: boolean; rules: unknown[]; actions: unknown[] }) => ReturnType<typeof callServerApi>;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const m = getMessages(language).serverMail.manage;
  const f = m.filters;
  const isCreate = mode === "create";

  const [name, setName] = useState(row?.name ?? "");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [rules, setRules] = useState<FilterRule[]>(() => {
    const r = normRules(row?.rules);
    return r.length ? r : [{ part: "from", match: "contains", value: "" }];
  });
  const [actions, setActions] = useState<FilterAction[]>(() => {
    const a = normActions(row?.actions);
    return a.length ? a : [{ type: "deliver_to_folder", value: "" }];
  });
  const [busy, setBusy] = useState(false);

  const partOptions = FILTER_PARTS.map((p) => ({ value: p, label: f.parts[p] }));
  const matchOptions = FILTER_MATCHES.map((mm) => ({ value: mm, label: f.matches[mm] }));
  const actionOptions = FILTER_ACTIONS.map((a) => ({ value: a, label: f.actionLabels[a] }));
  const joinOptions = [
    { value: "and", label: f.joinAnd },
    { value: "or", label: f.joinOr },
  ];

  const actionPlaceholder = (type: string): string =>
    type === "deliver_to_folder" ? f.folderPlaceholder : type === "redirect" ? f.redirectPlaceholder : type === "pipe" ? f.pipePlaceholder : f.failPlaceholder;

  const submit = async () => {
    if (!name.trim()) {
      throw new Error(f.errName);
    }
    const cleanRules = rules
      .map((r, i) => ({
        part: r.part,
        match: r.match,
        value: r.value ?? "",
        ...(i > 0 ? { joinWithPrevious: r.joinWithPrevious === "or" ? "or" : "and" } : {}),
      }))
      .filter((r) => FILTER_PARTS.includes(r.part as (typeof FILTER_PARTS)[number]));
    if (!cleanRules.length) {
      throw new Error(f.errRules);
    }
    const cleanActions = actions
      .filter((a) => FILTER_ACTIONS.includes(a.type as (typeof FILTER_ACTIONS)[number]))
      .map((a) => (ACTION_NEEDS_VALUE.has(a.type) ? { type: a.type, value: (a.value ?? "").trim() } : { type: a.type }));
    if (!cleanActions.length) {
      throw new Error(f.errActions);
    }
    setBusy(true);
    const payload = { name: name.trim(), enabled, rules: cleanRules, actions: cleanActions };
    const op = customSubmit
      ? () => customSubmit(payload)
      : !isCreate && row
        ? () => serverMailApi.updateFilter(panelId, token, accountId, String(row.id), payload)
        : () => serverMailApi.createFilter(panelId, token, accountId, payload);
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  const sectionLabel = (text: string, hint?: string) => (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "700" }}>{text}</Text>
      {hint ? <Text style={{ color: tokens.textMuted, fontSize: 11, marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={isCreate ? f.createTitle : f.editTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={f.cancel} onSubmit={submit} submitLabel={isCreate ? f.create : f.save} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={f.labelName}>
        <Input value={name} onChangeText={setName} placeholder={f.placeholderName} />
      </Field>
      <Checkbox value={enabled} onChange={setEnabled} label={f.labelEnabled} />
      <View style={{ height: 14 }} />

      {sectionLabel(f.rulesTitle, f.rulesHint)}
      {rules.map((r, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, marginBottom: 10, gap: 8 }}>
          {i > 0 ? (
            <Select value={r.joinWithPrevious ?? "and"} options={joinOptions} onChange={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, joinWithPrevious: v === "or" ? "or" : "and" } : x)))} />
          ) : null}
          <Select value={r.part} options={partOptions} onChange={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, part: v } : x)))} />
          <Select value={r.match} options={matchOptions} onChange={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, match: v } : x)))} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input value={r.value} onChangeText={(v) => setRules((prev) => prev.map((x, j) => (j === i ? { ...x, value: v } : x)))} placeholder={f.ruleValuePlaceholder} autoCapitalize="none" />
            </View>
            {rules.length > 1 ? (
              <Button label="" variant="ghost" size="sm" icon={<TablerTrash size={18} color={tokens.danger} />} onPress={() => setRules((prev) => prev.filter((_, j) => j !== i))} />
            ) : null}
          </View>
        </View>
      ))}
      <Button label={f.addRule} variant="secondary" size="sm" icon={<TablerPlus size={16} />} onPress={() => setRules((prev) => [...prev, { part: "from", match: "contains", value: "", joinWithPrevious: "and" }])} style={{ alignSelf: "flex-start", marginBottom: 16 }} />

      {sectionLabel(f.actionsTitle, f.actionsHint)}
      {actions.map((a, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, marginBottom: 10, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Select value={a.type} options={actionOptions} onChange={(v) => setActions((prev) => prev.map((x, j) => (j === i ? { ...x, type: v } : x)))} />
            </View>
            {actions.length > 1 ? (
              <Button label="" variant="ghost" size="sm" icon={<TablerTrash size={18} color={tokens.danger} />} onPress={() => setActions((prev) => prev.filter((_, j) => j !== i))} />
            ) : null}
          </View>
          {ACTION_NEEDS_VALUE.has(a.type) ? (
            <Input value={a.value ?? ""} onChangeText={(v) => setActions((prev) => prev.map((x, j) => (j === i ? { ...x, value: v } : x)))} placeholder={actionPlaceholder(a.type)} autoCapitalize="none" />
          ) : null}
        </View>
      ))}
      <Button label={f.addAction} variant="secondary" size="sm" icon={<TablerPlus size={16} />} onPress={() => setActions((prev) => [...prev, { type: "deliver_to_folder", value: "" }])} style={{ alignSelf: "flex-start" }} />
    </FormDrawer>
  );
}

/** Diálogo de firma: remitente + correo + vínculo + contenido (texto/HTML simple). */
export function SignatureDialog({
  panelId,
  token,
  accountId,
  account,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  accountId: string;
  account: MailAccount;
  mode: "create" | "edit";
  row?: Signature;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const m = getMessages(language).serverMail.manage;
  const s = m.signatures;
  const isCreate = mode === "create";

  const [senderName, setSenderName] = useState(row?.senderName ?? "");
  const [senderEmail, setSenderEmail] = useState(row?.senderEmail ?? "");
  const [linkToSender, setLinkToSender] = useState(row?.linkToSender === true);
  const [html, setHtml] = useState(row?.html ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const email = senderEmail.trim();
    const payload = {
      senderName: senderName.trim(),
      linkToSender,
      html,
      ...(email ? { senderEmail: email.toLowerCase() } : {}),
    };
    const op =
      !isCreate && row
        ? () => callServerApi(panelId, token, "PUT", `/api/accounts/${enc(accountId)}/signatures/${enc(String(row.id))}`, payload)
        : () => callServerApi(panelId, token, "POST", `/api/accounts/${enc(accountId)}/signatures`, payload);
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={isCreate ? s.createTitle : s.editTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={s.cancel} onSubmit={submit} submitLabel={isCreate ? s.create : s.save} submitting={busy} />}
    >
      <Field label={s.labelSenderName}>
        <Input value={senderName} onChangeText={setSenderName} placeholder={s.placeholderSenderName} />
      </Field>
      <Field label={s.labelSenderEmail}>
        <Input value={senderEmail} onChangeText={setSenderEmail} placeholder={account.address || s.placeholderSenderEmail} autoCapitalize="none" keyboardType="email-address" />
      </Field>
      <Checkbox value={linkToSender} onChange={setLinkToSender} label={s.labelLinked} />
      <View style={{ height: 12 }} />
      <Field label={s.labelHtml} hint={s.htmlHint}>
        <Input value={html} onChangeText={setHtml} multiline style={{ minHeight: 120 }} placeholder={s.placeholderHtml} />
      </Field>
    </FormDrawer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Contactos (libreta de la cuenta) · Carpetas IMAP (crear/renombrar/eliminar).
// ═══════════════════════════════════════════════════════════════════════════

/** Diálogo de contacto: correo + nombre (POST/PUT a /contacts). */
export function ContactDialog({
  panelId,
  token,
  accountId,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  accountId: string;
  mode: "create" | "edit";
  row?: Contact;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const c = getMessages(language).serverMail.manage.contacts;
  const isCreate = mode === "create";
  const [email, setEmail] = useState(row?.email ?? "");
  const [name, setName] = useState(row?.displayName ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim();
    if (!e || !e.includes("@")) {
      throw new Error(c.errEmail);
    }
    setBusy(true);
    const payload = { email: e.toLowerCase(), displayName: name.trim() || null };
    const op =
      !isCreate && row
        ? () => callServerApi(panelId, token, "PUT", `/api/accounts/${enc(accountId)}/contacts/${enc(String(row.id))}`, payload)
        : () => callServerApi(panelId, token, "POST", `/api/accounts/${enc(accountId)}/contacts`, payload);
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={isCreate ? c.createTitle : c.editTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={c.cancel} onSubmit={submit} submitLabel={isCreate ? c.create : c.save} submitting={busy} disabled={!email.trim()} />}
    >
      <Field label={c.labelEmail}>
        <Input value={email} onChangeText={setEmail} placeholder={c.placeholderEmail} autoCapitalize="none" keyboardType="email-address" />
      </Field>
      <Field label={c.labelName}>
        <Input value={name ?? ""} onChangeText={setName} placeholder={c.placeholderName} />
      </Field>
    </FormDrawer>
  );
}

/** Diálogo de calendario: nombre + color + descripción + zona horaria (POST/PUT). */
export function CalendarDialog({
  panelId,
  token,
  accountId,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  accountId: string;
  mode: "create" | "edit";
  row?: Calendar;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const c = getMessages(language).serverMail.manage.calendars;
  const isCreate = mode === "create";
  const [name, setName] = useState(row?.name ?? "");
  const [color, setColor] = useState(row?.color ?? "#3b82f6");
  const [description, setDescription] = useState(row?.description ?? "");
  const [timezone, setTimezone] = useState(row?.timezone ?? "UTC");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      throw new Error(c.errName);
    }
    setBusy(true);
    const payload = {
      name: nm,
      color: color.trim() || "#3b82f6",
      timezone: timezone.trim() || "UTC",
      description: description.trim() || null,
      enabled,
    };
    const op =
      !isCreate && row
        ? () => callServerApi(panelId, token, "PUT", `/api/accounts/${enc(accountId)}/calendars/${enc(String(row.id))}`, payload)
        : () => callServerApi(panelId, token, "POST", `/api/accounts/${enc(accountId)}/calendars`, payload);
    const out = await runServerMutation(panelId, token, op);
    setBusy(false);
    if (out.ok) onSaved(isCreate);
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={isCreate ? c.createTitle : c.editTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={c.cancel} onSubmit={submit} submitLabel={isCreate ? c.create : c.save} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={c.labelName}>
        <Input value={name} onChangeText={setName} placeholder={c.placeholderName} />
      </Field>
      <Field label={c.labelColor} hint={c.colorHint}>
        <Input value={color} onChangeText={setColor} placeholder="#3b82f6" autoCapitalize="none" />
      </Field>
      <Field label={c.labelDescription}>
        <Input value={description ?? ""} onChangeText={setDescription} placeholder={c.placeholderDescription} multiline style={{ minHeight: 70 }} />
      </Field>
      <Field label={c.labelTimezone}>
        <Input value={timezone} onChangeText={setTimezone} placeholder={c.placeholderTimezone} autoCapitalize="none" />
      </Field>
      <Checkbox value={enabled} onChange={setEnabled} label={c.labelEnabled} />
    </FormDrawer>
  );
}

/** Crear carpeta IMAP: nombre + carpeta padre opcional (POST /folders). */
export function FolderDialog({
  panelId,
  token,
  accountId,
  folders,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  accountId: string;
  folders: ManageFolder[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const f = getMessages(language).serverMail.manage.folders;
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);

  const parentOptions = [{ value: "", label: f.parentNone }, ...folders.filter((x) => !x.isProtected).map((x) => ({ value: x.path, label: x.path }))];

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      throw new Error(f.errName);
    }
    setBusy(true);
    const payload = { name: nm, ...(parent ? { parentPath: parent } : {}) };
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "POST", `/api/mail/${enc(accountId)}/folders`, payload));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={f.createTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={f.cancel} onSubmit={submit} submitLabel={f.create} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={f.labelName}>
        <Input value={name} onChangeText={setName} placeholder={f.placeholderName} autoCapitalize="none" />
      </Field>
      <Field label={f.labelParent} hint={f.parentHint}>
        <Select value={parent} options={parentOptions} onChange={setParent} />
      </Field>
    </FormDrawer>
  );
}

/** Renombrar carpeta IMAP (PUT /folders {path,name}). */
export function FolderRenameDialog({
  panelId,
  token,
  accountId,
  folder,
  onClose,
  onSaved,
  onError,
}: {
  panelId: string;
  token: string;
  accountId: string;
  folder: ManageFolder;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const language = loadSessionState().language;
  const f = getMessages(language).serverMail.manage.folders;
  const [name, setName] = useState(folder.name);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      throw new Error(f.errName);
    }
    setBusy(true);
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "PUT", `/api/mail/${enc(accountId)}/folders`, { path: folder.path, name: nm }));
    setBusy(false);
    if (out.ok) onSaved();
    else throw new Error(out.error ?? getMessages(language).common.error);
  };

  return (
    <FormDrawer
      visible
      onClose={onClose}
      title={f.renameTitle}
      language={language}
      footer={<DialogFooter onCancel={onClose} cancelLabel={f.cancel} onSubmit={submit} submitLabel={f.rename} submitting={busy} disabled={!name.trim()} />}
    >
      <Field label={f.labelNewName}>
        <Input value={name} onChangeText={setName} placeholder={f.placeholderName} autoCapitalize="none" />
      </Field>
    </FormDrawer>
  );
}
