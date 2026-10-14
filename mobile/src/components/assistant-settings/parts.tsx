import React, { useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { Button } from "../ui/Button";
import { s } from "./styles";

type T = Messages["assistantSettings"];

// Verde esmeralda del switch activo (paridad con el panel: los toggles de Config
// —skills/módulos/general— usan `emerald-500`, no el brand del servidor).
const SWITCH_ON_EMERALD = "#10b981";

/** Encabezado de una sección (título + descripción). */
export function SectionHead({ title, desc, tokens }: { title: string; desc?: string; tokens: ThemeTokens }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.sectionTitle, { color: tokens.textPrimary }]}>{title}</Text>
      {desc ? <Text style={[s.sectionDesc, { color: tokens.textMuted }]}>{desc}</Text> : null}
    </View>
  );
}

/** Estado de carga / error / vacío centrado. Reusa el patrón de las pantallas
 *  nativas de módulos (spinner de marca + texto). */
export function LoadState({
  t,
  tokens,
  mode,
  onRetry,
  emptyText,
}: {
  t: T;
  tokens: ThemeTokens;
  mode: "loading" | "error" | "empty";
  onRetry?: () => void;
  emptyText?: string;
}) {
  if (mode === "loading") {
    return (
      <View style={s.center}>
        <ActivityIndicator size="small" color={tokens.brand} />
        <Text style={[s.centerText, { color: tokens.textMuted }]}>{t.loading}</Text>
      </View>
    );
  }
  if (mode === "error") {
    return (
      <View style={s.center}>
        <Text style={[s.centerText, { color: tokens.danger }]}>{t.loadError}</Text>
        {onRetry ? <Button size="sm" variant="ghost" label={t.retry} onPress={onRetry} /> : null}
      </View>
    );
  }
  return (
    <View style={s.center}>
      <Text style={[s.centerText, { color: tokens.textMuted }]}>{emptyText ?? t.empty}</Text>
    </View>
  );
}

/** Fila switch + etiqueta + pista. */
export function ToggleRow({
  label,
  hint,
  value,
  disabled,
  onChange,
  tokens,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  tokens: ThemeTokens;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleMain}>
        <Text style={[s.toggleLabel, { color: tokens.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[s.toggleHint, { color: tokens.textMuted }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: tokens.border, true: SWITCH_ON_EMERALD }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/** Grupo colapsable (skills agrupadas por categoría). */
export function Collapsible({
  title,
  count,
  tokens,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  tokens: ThemeTokens;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, padding: 0 }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[s.rowBetween, { padding: 12 }]}
      >
        <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>
          {title}
          {typeof count === "number" ? <Text style={{ color: tokens.textMuted, fontWeight: "600" }}>{`  ·  ${count}`}</Text> : null}
        </Text>
        {open ? <ChevronDown size={18} color={tokens.textMuted} /> : <ChevronRight size={18} color={tokens.textMuted} />}
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>{children}</View> : null}
    </View>
  );
}
