import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import React, { useState } from "react";
import { TextInput, View, Text } from "react-native";
import { Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
export type BackupStorage = { id?: string | number; name?: string; provider?: string; bucket?: string; prefix?: string; endpoint?: string; region?: string; accessKeyId?: string };
export function NativeStorageEditor({ initial, credentials, onClose, onSave, busy, error }: { initial: BackupStorage; credentials?: boolean; onClose: () => void; onSave: (data: Record<string, string>) => void; busy: boolean; error?: string | null }) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const [form, setForm] = useState<Record<string, string>>({ provider: "s3", ...Object.fromEntries(Object.entries(initial).filter(([key]) => key !== "id").map(([key, value]) => [key, String(value ?? "")])) });
  const fields = credentials ? [["accountId", nativeText("Cuenta de Cloudflare (R2)")], ["endpoint", nativeText("Endpoint")], ["region", nativeText("Región")], ["accessKeyId", nativeText("Access Key ID")], ["secretAccessKey", nativeText("Secret Access Key")]] : [["name", nativeText("Nombre")], ["bucket", "Bucket"], ["prefix", "Prefijo"], ["endpoint", nativeText("Endpoint")], ["region", nativeText("Región")], ["accessKeyId", nativeText("Access Key ID (opcional)")], ["secretAccessKey", nativeText("Secret Access Key (opcional)")]];
  return <FormDrawer visible onClose={() => { if (!busy) onClose(); }} title={credentials ? nativeText("Credenciales de almacenamiento") : initial.id ? nativeText("Editar destino") : nativeText("Nuevo destino")} language="es" footer={<View style={{ flexDirection: "row", gap: 10 }}><Button label={nativeText("Cancelar")} variant="ghost" disabled={busy} onPress={onClose} /><Button label={nativeText("Guardar")} loading={busy} disabled={credentials ? !form.accessKeyId?.trim() : !form.name?.trim() || !form.bucket?.trim()} onPress={() => onSave(form)} /></View>}>
    {error ? <Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text> : null}
    <SegmentedControl items={[{ key: "s3", label: "Amazon / S3" }, { key: "r2", label: nativeText("Cloudflare R2") }]} value={form.provider} onChange={provider => setForm(current => ({ ...current, provider }))} />
    {fields.map(([key, label]) => <Field key={key} label={label}><TextInput value={form[key] ?? ""} onChangeText={value => setForm(current => ({ ...current, [key]: value }))} secureTextEntry={key === "secretAccessKey"} autoCapitalize="none" autoCorrect={false} style={{ padding: 12, borderWidth: 1, borderRadius: 10, borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.bgInput }} /></Field>)}
    <Text style={{ color: colors.textMuted, marginBottom: 12 }}>{nativeText("La clave secreta guardada se conserva si dejas su campo vacío.")}</Text>

  </FormDrawer>;
}
