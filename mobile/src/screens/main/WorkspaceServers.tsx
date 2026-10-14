import { nativeText } from '../../i18n/native-text';
import { useConfirmation } from "../../components/ui/useConfirmation";
import React, { useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { Check, ChevronLeft, Edit3, Plus, Server, Trash2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { callServerApi, unwrap } from "../../api/serverApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { Button } from "../../components/ui/Button";
import { FormSheet } from "../../components/ui/FormSheet";
import { Field, Checkbox } from "../../components/server/Form";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import type { PanelRow } from "../../features/app/viewModels";
export type WorkspaceTarget = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  isLocal?: boolean;
  enabled: boolean;
  hostFingerprint?: string | null;
  hostFingerprintPending?: string | null;
  lastStatus?: string;
  lastError?: string | null;
  hasLuxipanel?: boolean;
  luxipanelBaseUrl?: string | null;
};
type Draft = {
  name: string;
  host: string;
  port: string;
  username: string;
  authType: "password" | "key";
  secret: string;
  passphrase: string;
  enabled: boolean;
  hasLuxipanel: boolean;
  luxipanelBaseUrl: string;
};
const blank: Draft = {
  name: "",
  host: "",
  port: "22",
  username: "",
  authType: "password",
  secret: "",
  passphrase: "",
  enabled: true,
  hasLuxipanel: false,
  luxipanelBaseUrl: "",
};
/** Registered account panels and a panel's SSH vault are distinct lists. */
export function WorkspaceServers({
  panels,
  targets,
  panelId,
  token,
  language,
  selectedTarget,
  error,
  busy,
  onClose,
  onSelectPanel,
  onSelectTarget,
  onManagePanels,
  onEditPanel,
  onDeletePanel,
  onChanged,
}: {
  panels: PanelRow[];
  targets: WorkspaceTarget[];
  panelId: string;
  token: string;
  language: string;
  selectedTarget?: string;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSelectPanel: (id: string) => void;
  onSelectTarget: (target: WorkspaceTarget) => void;
  onManagePanels: () => void;
  onEditPanel?: (panel: PanelRow) => void;
  onDeletePanel?: (panel: PanelRow) => void;
  onChanged: (targets: WorkspaceTarget[]) => void;
}) {
  const { askConfirmation, confirmation } = useConfirmation(language);
  const colors = getThemeTokens(useTheme().theme === "dark"),
    insets = useSafeAreaInsets(),
    es = language.startsWith("es");
  const [tab, setTab] = useState(panelId ? "targets" : "panels");
  const [editing, setEditing] = useState<WorkspaceTarget | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft>(blank);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    const response = await callServerApi(panelId, token, "GET", "/api/servers");
    if (!response.ok) throw new Error(response.error ?? nativeText("No se pudieron cargar los servidores."));
    onChanged(unwrap<WorkspaceTarget[]>(response) ?? []);
  };
  const startEdit = (target: WorkspaceTarget | null) => {
    setDraft(
      target
        ? {
            ...blank,
            ...target,
            port: String(target.port),
            secret: "",
            passphrase: "",
            hasLuxipanel: target.hasLuxipanel ?? false,
            luxipanelBaseUrl: target.luxipanelBaseUrl ?? "",
          }
        : blank,
    );
    setNotice("");
    setEditing(target);
  };
  const execute = async (path: string, method: "POST" | "PUT" | "DELETE", body?: unknown) => {
    setSaving(true);
    setNotice("");
    try {
      const response = await callServerApi(panelId, token, method, path, body);
      if (!response.ok) throw new Error(response.error ?? `HTTP ${response.status}`);
      await refresh();
      return true;
    } catch (cause) {
      setNotice(String(cause instanceof Error ? cause.message : cause));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    const port = Number(draft.port);
    if (
      !draft.name.trim() ||
      !draft.host.trim() ||
      !draft.username.trim() ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      (!editing && !draft.secret)
    ) {
      setNotice(es ? nativeText("Completa los datos de conexión.") : nativeText("Complete the connection details."));
      return;
    }
    const body: Record<string, unknown> = { ...draft, port };
    if (!draft.secret) delete body.secret;
    if (!draft.passphrase) delete body.passphrase;
    if (!draft.luxipanelBaseUrl) delete body.luxipanelBaseUrl;
    if (
      await execute(
        editing ? `/api/servers/${encodeURIComponent(editing.id)}` : "/api/servers",
        editing ? "PUT" : "POST",
        body,
      )
    ) {
      setDraft(blank);
      setEditing(undefined);
    }
  };
  const test = async (target: WorkspaceTarget) => {
    setSaving(true);
    setNotice("");
    try {
      const response = await callServerApi(
        panelId,
        token,
        "POST",
        `/api/servers/${encodeURIComponent(target.id)}/test`,
      );
      await refresh();
      if (response.code === "HOST_FINGERPRINT_PENDING_APPROVAL") {
        const data = (response.data as { data?: { fingerprint?: string; changed?: boolean } })
          ?.data;
        if (!data?.fingerprint)
          throw new Error(response.error ?? nativeText("No se pudo verificar la huella."));
        Alert.alert(
          es ? nativeText("Verificar huella SSH") : nativeText("Verify SSH fingerprint"),
          `${target.name}\n${target.host}\n\n${data.fingerprint}\n\n${response.error ?? ""}`,
          [
            { text: es ? nativeText("Cancelar") : nativeText("Cancel"), style: "cancel" },
            {
              text: es ? nativeText("Aprobar huella") : nativeText("Approve fingerprint"),
              onPress: () =>
                void execute(
                  `/api/servers/${encodeURIComponent(target.id)}/fingerprint/approve`,
                  "POST",
                ),
            },
          ],
        );
      } else if (!response.ok) throw new Error(response.error ?? nativeText("SSH connection failed"));
      else setNotice(es ? nativeText("Conexión correcta.") : nativeText("Connection successful."));
    } catch (cause) {
      setNotice(String(cause instanceof Error ? cause.message : cause));
    } finally {
      setSaving(false);
    }
  };
  const field = (key: keyof Draft, label: string, secret = false, multiline = false) => (
    <Field label={label}>
      <TextInput
        value={String(draft[key])}
        onChangeText={(value) => setDraft((old) => ({ ...old, [key]: value }))}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secret && !multiline}
        multiline={multiline}
        keyboardType={key === "port" ? "numeric" : "default"}
        style={{
          color: colors.textPrimary,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 12,
          minHeight: multiline ? 110 : 44,
        }}
      />
    </Field>
  );
  return <>
      {confirmation}
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 120,
        backgroundColor: colors.bgPrimary,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          height: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Server size={21} color={colors.textPrimary} />
        <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: "700" }}>
          {es ? nativeText("Servidores") : nativeText("Servers")}
        </Text>
        <Pressable onPress={onClose} accessibilityLabel={es ? nativeText("Cerrar") : nativeText("Close")} hitSlop={12}>
          <X size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={{ padding: 12 }}>
        <SegmentedControl
          items={[
            { key: "panels", label: es ? nativeText("Mis paneles") : nativeText("My panels") },
            ...(panelId
              ? [{ key: "targets", label: es ? nativeText("Servidores del panel") : nativeText("Panel servers") }]
              : []),
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
        {error || notice ? (
          <Text selectable style={{ color: colors.danger }}>
            {notice || error}
          </Text>
        ) : null}
        {busy || saving ? <ActivityIndicator color={colors.brand} /> : null}
        {tab === "panels" ? (
          <>
            {panels.map((panel) => (
              <Pressable
                key={panel.id}
                disabled={busy}
                onPress={() => onSelectPanel(panel.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                }}
              >
                <Server size={22} color={colors.brand} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                    {panel.nameLabel}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
                    {panel.accessDomain}
                  </Text>
                </View>
                {panel.id === panelId ? <Check size={20} color={colors.brand} /> : null}
                {onEditPanel ? (
                  <Pressable
                    accessibilityLabel={es ? nativeText("Editar panel") : nativeText("Edit panel")}
                    onPress={(event) => {
                      event.stopPropagation();
                      onEditPanel(panel);
                    }}
                    hitSlop={10}
                  >
                    <Edit3 size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
                {onDeletePanel ? (
                  <Pressable
                    accessibilityLabel={es ? nativeText("Eliminar panel") : nativeText("Delete panel")}
                    onPress={(event) => {
                      event.stopPropagation();
                      onDeletePanel(panel);
                    }}
                    hitSlop={10}
                  >
                    <Trash2 size={18} color={colors.danger} />
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
            <Button
              label={es ? nativeText("Nuevo panel de mi cuenta") : nativeText("New account panel")}
              variant="secondary"
              onPress={onManagePanels}
            />
          </>
        ) : (
          <>
            {targets.map((target) => (
              <View
                key={target.id}
                style={{
                  padding: 14,
                  gap: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                }}
              >
                <Pressable
                  disabled={busy || saving || !target.enabled}
                  onPress={() => onSelectTarget(target)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Server size={20} color={colors.brand} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                      {target.name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {target.isLocal
                        ? es
                          ? nativeText("Esta caja")
                          : nativeText("This panel")
                        : `${target.username}@${target.host}:${target.port}`}
                    </Text>
                  </View>
                  {target.id === selectedTarget ? <Check size={20} color={colors.brand} /> : null}
                </Pressable>
                {!target.isLocal && (
                  <>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {target.lastError ?? target.lastStatus ?? ""}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Button
                        label={es ? nativeText("Probar conexión") : nativeText("Test connection")}
                        size="sm"
                        variant="secondary"
                        disabled={saving}
                        onPress={() => void test(target)}
                      />
                      <Pressable
                        disabled={saving}
                        onPress={() => startEdit(target)}
                        accessibilityLabel={es ? nativeText("Editar") : nativeText("Edit")}
                      >
                        <Edit3 size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        disabled={saving}
                        accessibilityLabel={es ? nativeText("Eliminar") : nativeText("Delete")}
                        onPress={() =>
                          askConfirmation(es ? nativeText("Eliminar servidor") : nativeText("Delete server"), target.name, [
                            { text: es ? nativeText("Cancelar") : nativeText("Cancel"), style: "cancel" },
                            {
                              text: es ? nativeText("Eliminar") : nativeText("Delete"),
                              style: "destructive",
                              onPress: () =>
                                execute(
                                  `/api/servers/${encodeURIComponent(target.id)}`,
                                  "DELETE",
                                ),
                            },
                          ])
                        }
                      >
                        <Trash2 size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}
            <Button
              label={es ? nativeText("Nuevo servidor") : nativeText("New server")}
              icon={<Plus size={18} color={colors.textPrimary} />}
              onPress={() => startEdit(null)}
            />
            <Button
              label={es ? nativeText("Actualizar") : nativeText("Refresh")}
              variant="ghost"
              onPress={() => void refresh().catch((cause) => setNotice(String(cause)))}
            />
          </>
        )}
      </ScrollView>
      <FormSheet
        visible={editing !== undefined}
        onClose={() => {
          if (!saving) {
            setDraft(blank);
            setEditing(undefined);
          }
        }}
        title={
          editing ? (es ? nativeText("Editar servidor") : nativeText("Edit server")) : es ? nativeText("Nuevo servidor") : nativeText("New server")
        }
        language={language}
        footer={
          <Button label={es ? nativeText("Guardar") : nativeText("Save")} onPress={() => void save()} loading={saving} />
        }
      >
        <View style={{ gap: 12 }}>
          {notice ? <Text style={{ color: colors.danger }}>{notice}</Text> : null}
          {field("name", es ? nativeText("Nombre") : nativeText("Name"))}
          {field("host", nativeText("Host"))}
          {field("port", es ? nativeText("Puerto SSH") : nativeText("SSH port"))}
          {field("username", es ? nativeText("Usuario SSH") : nativeText("SSH username"))}
          <SegmentedControl
            items={[
              { key: "password", label: es ? nativeText("Contraseña") : nativeText("Password") },
              { key: "key", label: es ? nativeText("Clave privada") : nativeText("Private key") },
            ]}
            value={draft.authType}
            onChange={(authType) =>
              setDraft((old) => ({ ...old, authType: authType as Draft["authType"] }))
            }
          />
          {field(
            "secret",
            draft.authType === "key"
              ? es
                ? nativeText("Clave privada")
                : nativeText("Private key")
              : es
                ? nativeText("Contraseña")
                : nativeText("Password"),
            true,
            draft.authType === "key",
          )}
          {editing ? (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {es
                ? nativeText("Deja la credencial vacía para conservar la guardada.")
                : nativeText("Leave credentials empty to retain the saved credential.")}
            </Text>
          ) : null}
          {draft.authType === "key"
            ? field("passphrase", es ? nativeText("Frase de paso") : nativeText("Passphrase"), true)
            : null}
          <Checkbox
            label={es ? nativeText("Habilitado") : nativeText("Enabled")}
            value={draft.enabled}
            onChange={(enabled) => setDraft((old) => ({ ...old, enabled }))}
          />
          <Checkbox
            label={es ? nativeText("Este servidor tiene LUXIPANEL") : nativeText("This server runs LUXIPANEL")}
            value={draft.hasLuxipanel}
            onChange={(hasLuxipanel) => setDraft((old) => ({ ...old, hasLuxipanel }))}
          />
          {draft.hasLuxipanel ? field("luxipanelBaseUrl", "URL LUXIPANEL") : null}
        </View>
      </FormSheet>
    </View>
  </>;
}
