import React, { useEffect, useRef, useState } from "react";
import { View, Linking } from "react-native";
import { PanelText as Text } from "../../components/ui/PanelText";
import { Button } from "../../components/ui/Button";
import { callServerApi } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import type { ThemeTokens } from "../../theme/colors";
import { nativeText } from "../../i18n/native-text";
type Activity = { items: { id: string; title: string; author: string; url: string; updatedAt: string; read: boolean }[]; unread: number; error?: string };
type Releases = { currentVersion?: string; latest?: { tag: string; name: string }; updateAvailable: boolean; canInstall?: boolean; error?: string };
export function WorkspaceCommunity({ panelId, token, colors }: { panelId: string; token: string; colors: ThemeTokens }) {
 const epoch = useRef(0); const [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const activity = useServerResource<Activity>(() => callServerApi(panelId, token, "GET", "/api/ui/community"), [panelId, token]);
 const versions = useServerResource<Releases>(() => callServerApi(panelId, token, "GET", "/api/ui/releases"), [panelId, token]);
 useEffect(() => { epoch.current++; setError(""); setBusy(false); return () => { epoch.current++; }; }, [panelId, token]);
 const update = async (path: string, body: unknown) => { if (busy) return; const current = epoch.current; setBusy(true); try { const result = await callServerApi(panelId, token, "POST", path, body); if (current !== epoch.current) return; if (!result.ok) throw new Error(result.error || nativeText("No se pudo completar la operación")); await activity.reload(); await versions.reload(); } catch (cause) { if (current === epoch.current) setError((cause as Error).message); } finally { if (current === epoch.current) setBusy(false); } };
 return <View style={{ gap: 10, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border }}>
  <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{nativeText("Comunidad y versiones")}{activity.data?.unread ? ` · ${activity.data.unread}` : ""}</Text>
  {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
  {versions.data?.latest && <Text style={{ color: colors.textSecondary }}>{versions.data.currentVersion} → {versions.data.latest.tag}</Text>}
  {versions.data?.updateAvailable && versions.data.canInstall && <Button label={nativeText("Actualizar LUXIPANEL")} disabled={busy} onPress={() => { void update("/api/admin/system/releases/install", { tag: versions.data!.latest!.tag }); }} />}
  {(activity.data?.items || []).slice(0, 30).map(item => <View key={item.id} style={{ gap: 6, padding: 10, borderRadius: 10, backgroundColor: item.read ? colors.bgPrimary : colors.bgCardSolid }}>
   <Text style={{ color: colors.textSecondary, fontSize: 11 }}>@{item.author} · {new Date(item.updatedAt).toLocaleString()}</Text><Text style={{ color: colors.textPrimary }}>{item.title}</Text>
   {/^(https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/(?:issues|pull)\/\d+)(?:#.*)?$/.test(item.url) && <Button label={nativeText("Abrir en GitHub")} variant="secondary" onPress={() => { void Linking.openURL(item.url); }} />}
   {!item.read && <Button label={nativeText("Marcar como leído")} variant="secondary" disabled={busy} onPress={() => { void update(`/api/ui/community/${item.id}/read`, {}); }} />}
  </View>)}
 </View>;
}
