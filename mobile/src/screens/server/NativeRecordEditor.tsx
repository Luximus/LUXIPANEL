import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import React, { useState } from "react";
import { TextInput, View, Text } from "react-native";
import { Checkbox, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Column = { name: string; nullable: boolean; dataType: string };
/** Native per-column editor; null is explicit, distinct from an empty string. */
export function NativeRecordEditor({ columns, initial, onSave, onClose, busy, error }: { columns: Column[]; initial: Record<string, string | null>; onSave: (values: Record<string, string | null>) => void; onClose: () => void; busy: boolean; error?: string | null }) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const [values, setValues] = useState(initial);
  return <FormDrawer visible onClose={() => { if (!busy) onClose(); }} title={nativeText("Registro")} language="es" footer={<View style={{ flexDirection: "row", gap: 10 }}><Button label={nativeText("Cancelar")} variant="ghost" onPress={onClose} disabled={busy} /><Button label={nativeText("Guardar")} loading={busy} onPress={() => onSave(values)} /></View>}>
    {error ? <Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text> : null}
    {columns.map(column => <Field key={column.name} label={column.name} hint={column.dataType}>
      <TextInput value={values[column.name] ?? ""} editable={!busy && values[column.name] !== null} autoCorrect={false} autoCapitalize="none" onChangeText={value => setValues(current => ({ ...current, [column.name]: value }))} style={{ color: colors.textPrimary, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 }} />
      {column.nullable ? <Checkbox label="NULL" disabled={busy} value={values[column.name] === null} onChange={value => setValues(current => ({ ...current, [column.name]: value ? null : "" }))} /> : null}
    </Field>)}

  </FormDrawer>;
}
