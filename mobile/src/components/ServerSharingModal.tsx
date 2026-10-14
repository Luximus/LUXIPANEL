import { useCallback, useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import { Trash2, X } from "lucide-react-native";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getMessages } from "../i18n";
import {
  getSshKeys,
  listGroups,
  createGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  listServerUserShares,
  createServerUserShare,
  createPanelAccessLink,
  revokeServerUserShare,
  type CustomerGroup,
  type ServerUserShare,
} from "../api/client";

/**
 * Drawer de formularios "Gestionar acceso" (solo dueño): comparte un usuario Linux / llave SSH
 * concreta de un servidor con clientes o grupos propios. Mediado por gateway:
 * el destinatario nunca ve la llave. Paridad con web/desktop ServerSharingModal.
 */
type AttachedKey = { id: string; linuxUsername: string | null };

export function ServerSharingModal({
  open,
  panelId,
  panelName,
  token,
  language,
  onClose,
}: {
  open: boolean;
  panelId: string | null;
  panelName?: string;
  token: string | null;
  language?: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const t = getMessages(language).sharing;

  const [tab, setTab] = useState<"access" | "groups">("access");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attachedKeys, setAttachedKeys] = useState<AttachedKey[]>([]);
  const [shares, setShares] = useState<ServerUserShare[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);

  const [formKeyId, setFormKeyId] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formGroupId, setFormGroupId] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    if (!panelId || !token) return;
    setError(null);
    try {
      const keys = await getSshKeys(token);
      setAttachedKeys(
        keys
          .filter((k) => Array.isArray(k.panelIds) && k.panelIds.includes(panelId))
          .map((k) => ({ id: k.id, linuxUsername: k.linuxUsername ?? null })),
      );
      const [sharesRes, groupsRes] = await Promise.all([listServerUserShares(panelId, token), listGroups(token)]);
      setShares(sharesRes.shares ?? []);
      setGroups(groupsRes.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }, [panelId, token, t.error]);

  useEffect(() => {
    if (open && panelId) {
      setTab("access");
      void loadAll();
    }
  }, [open, panelId, loadAll]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy || !token) return;
    setBusy(true);
    setError(null);
    try { await fn(); await loadAll(); }
    catch (err) { setError(err instanceof Error ? err.message : t.error); }
    finally { setBusy(false); }
  };

  const activeShares = shares.filter((s) => !s.revokedAt);
  const label = (k: AttachedKey) => k.linuxUsername ?? k.id.slice(0, 8);

  // Genera un enlace de invitación (sin cuenta) y lo abre en el share sheet.
  const generateGuestLink = async (kind: "full" | "granular") => {
    if (!panelId || !token || busy) return;
    if (kind === "granular" && !formKeyId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createPanelAccessLink(panelId, "guest", token, {
        kind,
        sshKeyId: kind === "granular" ? formKeyId : undefined,
      });
      const url = res.link?.url;
      if (!url) throw new Error(t.error);
      await Share.share({ message: `${panelName ?? t.title}\n${url}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet visible={open} onClose={onClose} title={panelName ? `${t.title} — ${panelName}` : t.title} language={language}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Button variant={tab === "access" ? "primary" : "ghost"} size="sm" label={t.tabAccess} onPress={() => setTab("access")} />
        <Button variant={tab === "groups" ? "primary" : "ghost"} size="sm" label={t.tabGroups} onPress={() => setTab("groups")} />
      </View>

      {error ? <Text style={{ color: tokens.danger, marginBottom: 8 }}>{error}</Text> : null}

      {tab === "access" ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.accessIntro}</Text>
          {attachedKeys.length === 0 ? (
            <Text style={{ color: tokens.textMuted }}>{t.noKeys}</Text>
          ) : (
            <>
              <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{t.selectUser}</Text>
              <Select
                value={formKeyId}
                placeholder="—"
                options={attachedKeys.map((k) => ({ value: k.id, label: label(k) }))}
                onChange={setFormKeyId}
              />
              <Input
                label={t.targetEmail}
                value={formEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!formGroupId}
                onChangeText={setFormEmail}
                placeholder="cliente@email.com"
              />
              <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{t.orPickGroup}</Text>
              <Select
                value={formGroupId}
                placeholder="—"
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
                onChange={(v) => { setFormGroupId(v); if (v) setFormEmail(""); }}
              />
              <Button
                variant="primary"
                label={t.shareBtn}
                disabled={busy || !formKeyId || (!formEmail && !formGroupId)}
                onPress={() => void run(() => createServerUserShare(panelId!, {
                  sshKeyId: formKeyId,
                  targetEmail: formEmail || undefined,
                  targetGroupId: formGroupId || undefined,
                }, token!).then(() => { setFormEmail(""); setFormGroupId(""); }))}
              />

              <View style={{ borderTopWidth: 1, borderTopColor: tokens.border, paddingTop: 10, marginTop: 4, gap: 6 }}>
                <Text style={{ color: tokens.textPrimary, fontWeight: "600", fontSize: 13 }}>{t.guestLinkTitle}</Text>
                <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.guestLinkIntro}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Button variant="secondary" size="sm" label={t.genFullLink} disabled={busy} onPress={() => void generateGuestLink("full")} />
                  <Button variant="secondary" size="sm" label={t.genGranularLink} disabled={busy || !formKeyId} onPress={() => void generateGuestLink("granular")} />
                </View>
              </View>
            </>
          )}

          {activeShares.length === 0 ? (
            <Text style={{ color: tokens.textMuted, marginTop: 8 }}>{t.noShares}</Text>
          ) : (
            activeShares.map((s, idx) => (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: idx === activeShares.length - 1 ? 0 : 1, borderBottomColor: tokens.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tokens.textPrimary, fontSize: 13 }}>
                    {(s.linuxUsername ?? "—")} → {s.targetType === "group" ? `${t.groupPrefix}: ${s.targetGroup?.name ?? ""}` : (s.targetCustomer?.email ?? s.targetCustomer?.name ?? "")}
                  </Text>
                  <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{s.status === "accepted" ? t.statusAccepted : t.statusPending}</Text>
                </View>
                <IconButton variant="secondary" size={38} onPress={() => void run(() => revokeServerUserShare(s.id, token!))} accessibilityLabel={t.revoke} icon={<Trash2 size={15} color={tokens.danger} />} style={{ borderColor: tokens.danger }} />
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{t.groupsIntro}</Text>
          <Input label={t.newGroupName} value={newGroupName} onChangeText={setNewGroupName} />
          <Button variant="primary" label={t.createGroup} disabled={busy || !newGroupName.trim()} onPress={() => void run(() => createGroup(newGroupName.trim(), undefined, token!).then(() => setNewGroupName("")))} />

          {groups.length === 0 ? (
            <Text style={{ color: tokens.textMuted, marginTop: 8 }}>{t.noGroups}</Text>
          ) : (
            groups.map((g) => (
              <View key={g.id} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 10, gap: 8, marginTop: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: tokens.textPrimary, fontWeight: "600" }}>{g.name}</Text>
                  <IconButton variant="secondary" size={36} onPress={() => void run(() => deleteGroup(g.id, token!))} accessibilityLabel={t.deleteGroup} icon={<Trash2 size={14} color={tokens.danger} />} style={{ borderColor: tokens.danger }} />
                </View>
                {g.members.length === 0 ? (
                  <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.noMembers}</Text>
                ) : (
                  g.members.map((m) => (
                    <View key={m.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ color: tokens.textSecondary, fontSize: 12, flex: 1 }}>
                        {m.customer.email ?? m.customer.name ?? ""} · {m.status === "accepted" ? t.statusAccepted : t.statusPending}
                      </Text>
                      <IconButton variant="secondary" size={34} onPress={() => void run(() => removeGroupMember(g.id, m.id, token!))} accessibilityLabel={t.revoke} icon={<X size={13} color={tokens.textMuted} />} />
                    </View>
                  ))
                )}
                <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label={t.addMemberEmail}
                      value={memberEmail[g.id] ?? ""}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={(v) => setMemberEmail((mm) => ({ ...mm, [g.id]: v }))}
                    />
                  </View>
                  <Button variant="secondary" size="sm" label={t.add} disabled={busy || !(memberEmail[g.id] ?? "").trim()} onPress={() => void run(() => addGroupMember(g.id, (memberEmail[g.id] ?? "").trim(), token!).then(() => setMemberEmail((mm) => ({ ...mm, [g.id]: "" }))))} />
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </FormSheet>
  );
}
