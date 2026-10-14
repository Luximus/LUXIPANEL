import { useConfirmation } from "../ui/useConfirmation";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Plus, Server, Trash2 } from "lucide-react-native";
import { registeredServersApi } from "./agents/agents-api";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { s } from "./styles";
import type { RegisteredAuthType, RegisteredServerPayload, RegisteredServerView } from "./types";

type T = Messages["assistantSettings"];

const EMPTY: RegisteredServerPayload = {
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "password",
  secret: "",
  passphrase: "",
};

function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/**
 * Sub-tab "Servidores": registro de credenciales SSH de OTROS servidores para
 * que el asistente los alcance (tools servers.*). Los secretos son write-only
 * (la lista nunca los devuelve). Réplica nativa de `ServersTab.tsx` de LUXIPANEL.
 */
export function ServersSubTab({
  panelId,
  token,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const { askConfirmation, confirmation } = useConfirmation();
  const v = t.serversTab;
  const [servers, setServers] = useState<RegisteredServerView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<RegisteredServerView | null>(null);
  const [form, setForm] = useState<RegisteredServerPayload>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = React.useCallback(() => {
    let cancelled = false;
    void registeredServersApi.list(panelId, token).then((rows) => {
      if (!cancelled) setServers(rows);
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  useEffect(() => reload(), [reload]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setErr(null);
    setShowForm(true);
  };
  const openEdit = (srv: RegisteredServerView) => {
    setEditing(srv);
    // Los secretos nunca vuelven — se dejan vacíos (vacío = conservar).
    setForm({ name: srv.name, host: srv.host, port: srv.port, username: srv.username, authType: srv.authType, secret: "", passphrase: "" });
    setErr(null);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      setErr(v.requiredFields);
      return;
    }
    if (!editing && !form.secret?.trim()) {
      setErr(form.authType === "password" ? v.passwordRequired : v.keyRequired);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload: Partial<RegisteredServerPayload> = {
        name: form.name.trim(),
        host: form.host.trim(),
        port: Number(form.port) || 22,
        username: form.username.trim(),
        authType: form.authType,
      };
      // Solo mandar secretos si se rellenaron (vacío en edición = conservar).
      if (form.secret?.trim()) payload.secret = form.secret;
      if (form.authType === "key") payload.passphrase = form.passphrase || null;
      if (editing) await registeredServersApi.update(panelId, token, editing.id, payload);
      else await registeredServersApi.create(panelId, token, payload as RegisteredServerPayload);
      setShowForm(false);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const del = (srv: RegisteredServerView) => {
    askConfirmation(v.deleteTitle, fmt(v.deleteConfirm, { name: srv.name }), [
      { text: t.cancel, style: "cancel" },
      {
        text: t.delete,
        style: "destructive",
        onPress: () => registeredServersApi.remove(panelId, token, srv.id).then(() => reload()),
      },
    ]);
  };

  return <>
      {confirmation}
    <View style={s.root}>
      <View style={[s.rowBetween, { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: tokens.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.sectionTitle, { color: tokens.textPrimary }]}>{v.title}</Text>
          <Text style={[s.sectionDesc, { color: tokens.textMuted }]}>{v.subtitle}</Text>
        </View>
        <Button size="sm" variant="primary" label={v.register} icon={<Plus size={15} color="#fff" />} onPress={openCreate} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} nestedScrollEnabled>
        {err ? (
          <View style={[s.card, { backgroundColor: `${tokens.danger}18`, borderColor: tokens.danger, padding: 10 }]}>
            <Text style={[s.cardDesc, { color: tokens.danger }]}>⚠ {err}</Text>
          </View>
        ) : null}

        {servers === null ? (
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{t.loading}</Text>
        ) : servers.length === 0 && !showForm ? (
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{v.empty}</Text>
        ) : null}

        {(servers ?? []).map((srv) => (
          <View key={srv.id} style={[s.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }]}>
            <View style={[s.iconBox, { backgroundColor: tokens.bgInput }]}>
              <Server size={16} color={tokens.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>{srv.name}</Text>
              <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={1}>
                {srv.username}@{srv.host}:{srv.port} · {srv.authType === "password" ? v.authPassword : v.authKey}
                {srv.authType === "key" && srv.hasPassphrase ? v.passphraseSuffix : ""}
              </Text>
            </View>
            <Button size="sm" variant="ghost" label={t.edit} onPress={() => openEdit(srv)} />
            <Pressable onPress={() => del(srv)} hitSlop={8} style={{ padding: 6 }} accessibilityLabel={t.delete}>
              <Trash2 size={16} color={tokens.textMuted} />
            </Pressable>
          </View>
        ))}

        {showForm ? (
          <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.brand, gap: 10 }]}>
            <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{editing ? v.editServer : v.newServer}</Text>

            <Input label={v.nameLabel} value={form.name} onChangeText={(x) => setForm({ ...form, name: x })} placeholder="ats" autoCapitalize="none" />
            <Input label={v.hostLabel} value={form.host} onChangeText={(x) => setForm({ ...form, host: x })} placeholder="10.0.0.5" autoCapitalize="none" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input label={v.usernameLabel} value={form.username} onChangeText={(x) => setForm({ ...form, username: x })} placeholder="root" autoCapitalize="none" />
              </View>
              <View style={{ width: 100 }}>
                <Input label={v.portLabel} value={String(form.port)} onChangeText={(x) => setForm({ ...form, port: Number(x) || 22 })} placeholder="22" keyboardType="number-pad" />
              </View>
            </View>

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{v.authLabel}</Text>
              <Select
                value={form.authType}
                onChange={(x) => setForm({ ...form, authType: x as RegisteredAuthType, secret: "" })}
                options={[
                  { value: "password", label: v.authPasswordOption },
                  { value: "key", label: v.authKeyOption },
                ]}
              />
            </View>

            {form.authType === "password" ? (
              <Input
                label={`${v.passwordLabel}${editing ? ` ${v.keepHint}` : ""}`}
                value={form.secret ?? ""}
                onChangeText={(x) => setForm({ ...form, secret: x })}
                secureTextEntry
                secureToggle
                placeholder={editing ? "••••••••" : ""}
                autoCapitalize="none"
              />
            ) : (
              <>
                <Input
                  label={`${v.keyLabel}${editing ? ` ${v.keepHint}` : ""}`}
                  value={form.secret ?? ""}
                  onChangeText={(x) => setForm({ ...form, secret: x })}
                  multiline
                  placeholder={editing ? v.keyPlaceholderEdit : v.keyPlaceholderNew}
                  autoCapitalize="none"
                  style={{ fontFamily: "monospace", fontSize: 11, minHeight: 90 }}
                />
                <Input
                  label={v.passphraseLabel}
                  value={form.passphrase ?? ""}
                  onChangeText={(x) => setForm({ ...form, passphrase: x })}
                  secureTextEntry
                  secureToggle
                  autoCapitalize="none"
                />
              </>
            )}

            <View style={s.actionsRow}>
              <Button size="sm" variant="ghost" label={t.cancel} onPress={() => setShowForm(false)} />
              <Button size="sm" variant="primary" label={busy ? t.saving : t.save} disabled={busy} onPress={() => void save()} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  </>;
}

export default ServersSubTab;
