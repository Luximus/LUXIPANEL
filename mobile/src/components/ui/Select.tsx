import React, { useState } from "react";
import { Pressable } from "react-native";
import { PanelText as Text } from "./PanelText";
import { useModuleUi } from "./ModuleUi";
import { Check, ChevronDown } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { FormSheet } from "./FormSheet";
import { styles } from "./Select.styles";

export type SelectOption = { value: string; label: string };

export function Select({
  value,
  options,
  placeholder,
  onChange,
  style,
  leading,
  accessibilityLabel,
  compact = false,
  showPlaceholderWhenEmpty = false,
}: {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (next: string) => void;
  style?: object;
  leading?: React.ReactNode;
  accessibilityLabel?: string;
  /** Trigger reducido para barras con varios selectores; las opciones conservan su tamaño. */
  compact?: boolean;
  showPlaceholderWhenEmpty?: boolean;
}) {
  const { theme } = useTheme();
  const moduleUi = useModuleUi();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const direction = getLocaleDirection(language);
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const label = showPlaceholderWhenEmpty && !value ? placeholder ?? "" : current?.label ?? placeholder ?? "";

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[
          styles.trigger,
          { backgroundColor: tokens.bgInput, borderColor: tokens.border, direction, flexDirection: getLocaleRowDirection(language) },
          moduleUi && { minHeight: 32, paddingVertical: 6, borderRadius: 5, backgroundColor: tokens.bgPrimary },
          compact && { gap: 3 },
          style,
        ]}
      >
        {leading}
        <Text
          numberOfLines={1}
          style={[styles.triggerLabel, moduleUi && { fontWeight: "500" }, compact && { fontSize: 10, fontWeight: "500" }, { color: current ? tokens.textPrimary : tokens.textMuted, textAlign: getLocaleTextAlign(language) }]}
        >
          {label}
        </Text>
        <ChevronDown size={compact ? 10 : 14} color={tokens.textMuted} />
      </Pressable>
      {/* Las opciones se despliegan en el drawer central de formularios (hasta
          80% de pantalla), no en un modal centrado: estándar de la app para
          formularios/selects/filtros. */}
      <FormSheet visible={open} onClose={() => setOpen(false)} title={placeholder} language={language}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={[
                styles.row,
                { flexDirection: getLocaleRowDirection(language) },
                active && { backgroundColor: tokens.brandDim },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.rowLabel,
                  { color: active ? tokens.brand : tokens.textSecondary, flex: 1, textAlign: getLocaleTextAlign(language) },
                ]}
              >
                {option.label}
              </Text>
              {active ? <Check size={16} color={tokens.brand} /> : null}
            </Pressable>
          );
        })}
      </FormSheet>
    </>
  );
}
