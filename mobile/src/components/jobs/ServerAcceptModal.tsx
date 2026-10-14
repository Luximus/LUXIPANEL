import React, { useEffect, useMemo, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleTextAlign, getMessages } from "../../i18n";
import { FormSheet } from "../ui/FormSheet";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { listMyServers, listServerProviders, type JobServer } from "../../api/jobs";
import { jt, type JobsDict } from "./jobs-i18n";

/** Modal "Aceptar — trabajo en servidor": el profesional elige su server + proveedor. */
export function ServerAcceptModal({
  visible,
  token,
  dict,
  language,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  token: string;
  dict: JobsDict;
  language: string;
  onClose: () => void;
  onConfirm: (professionalServerId: string, provider: string | null) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const textAlign = getLocaleTextAlign(language);
  const styles = useMemo(() => makeStyles(), []);

  const [servers, setServers] = useState<JobServer[]>([]);
  const [serverId, setServerId] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) { setSubmitting(false); return; }
    let alive = true;
    void listMyServers(token).then((list) => {
      if (!alive) return;
      setServers(list);
      if (list.length) setServerId(list[0].id);
    }).catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [visible, token]);

  useEffect(() => {
    if (!visible || !serverId) { setProviders([]); setProvider(""); return; }
    const srv = servers.find((x) => x.id === serverId);
    if (!srv) return;
    let alive = true;
    void listServerProviders(token, srv.panelId).then((res) => {
      if (!alive) return;
      setProviders(res.providers ?? []);
      setProvider(res.providers?.[0] ?? "");
    });
    return () => { alive = false; };
  }, [visible, serverId, servers, token]);

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title={jt(dict, "server.accept.title")}
      language={language}
      footer={
        <View style={styles.footerRow}>
          <Button label={getMessages(language).common.cancel} variant="ghost" onPress={onClose} style={styles.footerBtn} />
          <Button
            label={jt(dict, "action.accept")}
            variant="primary"
            loading={submitting}
            disabled={!serverId}
            onPress={() => { setSubmitting(true); onConfirm(serverId, provider || null); }}
            style={styles.footerBtn}
          />
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={[styles.hint, { color: tokens.textSecondary, textAlign }]}>{jt(dict, "server.accept.hint")}</Text>
        <Text style={[styles.label, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "server.myServer")}</Text>
        {servers.length ? (
          <Select value={serverId} onChange={setServerId} options={servers.map((s) => ({ value: s.id, label: `${s.name} (${s.hostname})` }))} />
        ) : (
          <Text style={[styles.notice, { color: tokens.warning, textAlign }]}>{jt(dict, "server.noServers")}</Text>
        )}
        <Text style={[styles.label, { color: tokens.textPrimary, textAlign }]}>{jt(dict, "server.provider")}</Text>
        {providers.length ? (
          <Select value={provider} onChange={setProvider} options={providers.map((p) => ({ value: p, label: p }))} />
        ) : (
          <Text style={[styles.notice, { color: tokens.textMuted, textAlign }]}>{jt(dict, "server.provider.none")}</Text>
        )}
      </View>
    </FormSheet>
  );
}

function makeStyles() {
  return StyleSheet.create({
    body: { gap: 8 },
    hint: { fontSize: 13, marginBottom: 4 },
    label: { fontSize: 13, fontWeight: "600", marginTop: 6 },
    notice: { fontSize: 13 },
    footerRow: { flexDirection: "row", gap: 10 },
    footerBtn: { flex: 1 },
  });
}
