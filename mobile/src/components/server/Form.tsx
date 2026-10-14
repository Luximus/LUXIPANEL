import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
/**
 * Form — helpers para calcar la estructura de los `<dialog>` de LUXIPANEL en RN:
 * campos con label, checkbox, pie de diálogo (Cancelar/Guardar) y un
 * ConfirmDialog (réplica de `openConfirm`). Reusan los primitivos de la app.
 */
import React, { useContext, useLayoutEffect, useRef, useState } from "react";
import { FormSubmissionContext } from "./form-submission-context";
import { Pressable, View } from "react-native";
import { PanelText as Text } from "../ui/PanelText";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../theme/colors";
import { Button } from "../ui/Button";
import { TablerCheck } from "../../features/app/tabler-icons";

/** Bloque de campo: label arriba + control + hint/error opcional. */
export function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      {label ? <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600" }}>{label}</Text> : null}
      {children}
      {hint ? <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{hint}</Text> : null}
    </View>
  );
}

/** Checkbox con label a la derecha (réplica de los checkbox `accent-primary`). */
export function Checkbox({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          borderWidth: 1.5,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: value ? tokens.brand : "transparent",
          borderColor: value ? tokens.brand : tokens.border,
        }}
      >
        {value ? <TablerCheck size={13} color="#ffffff" /> : null}
      </View>
      {label ? <Text style={{ color: tokens.textSecondary, fontSize: 14, flexShrink: 1 }}>{label}</Text> : null}
    </Pressable>
  );
}

/** Caja de info/aviso (réplica de los bloques de tinte translúcido con borde). */
export function InfoBox({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "danger" }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const base = tone === "warn" ? tokens.warning : tone === "danger" ? tokens.danger : tokens.brand;
  return (
    <View
      style={{
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        marginBottom: 14,
        backgroundColor: withAlpha(base, 0.1),
        borderColor: withAlpha(base, 0.3),
      }}
    >
      {typeof children === "string" ? <Text style={{ color: tokens.textSecondary, fontSize: 12, lineHeight: 18 }}>{children}</Text> : children}
    </View>
  );
}

/** Pie de diálogo: Cancelar (ghost) + acción primaria/danger. */
export function DialogFooter({
  onCancel,
  cancelLabel,
  onSubmit,
  submitLabel,
  submitting,
  danger,
  disabled,
}: {
  onCancel: () => void;
  cancelLabel: string;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const form = useContext(FormSubmissionContext);
  const pending = useRef(false);
  const [waiting, setWaiting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  useLayoutEffect(() => { form?.setPending(!!submitting || waiting); }, [form, submitting, waiting]);
  const submit = async () => {
    if (pending.current || submitting || disabled) return;
    pending.current = true; form?.setPending(true); setWaiting(true); setSubmitError(null);
    try { await onSubmit(); }
    catch (cause) { setSubmitError(cause instanceof Error ? cause.message : nativeText("No se pudo guardar. Inténtalo de nuevo.")); }
    finally { pending.current = false; setWaiting(false); }
  };
  return (
    <View style={{ flex: 1, gap: 8 }}>
      {submitError ? <Text accessibilityRole="alert" style={{color:tokens.danger}}>{localizeServerError(submitError)}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
      <Button label={cancelLabel} variant="ghost" disabled={submitting || waiting} onPress={() => { if (!pending.current && !submitting) onCancel(); }} style={{ flex: 1 }} />
      <Button
        label={submitLabel}
        variant={danger ? "danger" : "primary"}
        onPress={() => void submit()}
        loading={submitting || waiting}
        disabled={disabled}
        style={{ flex: 1 }}
      />
      </View>
    </View>
  );
}

export { ConfirmationModal as ConfirmDialog } from "../ui/ConfirmationModal";

/** Estado de un ConfirmDialog imperativo gestionado por la pantalla. */
export type ConfirmState = {
  title: string;
  message: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};
