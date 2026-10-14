import React, { useContext, useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { PanelText as Text, PanelFontsReady } from "./PanelText";
import { useModuleUi } from "./ModuleUi";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleDirection, getLocaleTextAlign } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { styles } from "./Input.styles";

export const Input = React.forwardRef<TextInput, TextInputProps & { label?: string; hint?: string; error?: string; multiline?: boolean; secureToggle?: boolean }>(function Input({
  label,
  hint,
  error,
  multiline,
  secureToggle,
  secureTextEntry,
  ...props
}, ref) {
  const { theme } = useTheme();
  const compact = useModuleUi();
  const fontsReady = useContext(PanelFontsReady);
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const direction = getLocaleDirection(language);
  const [revealed, setRevealed] = useState(false);
  // With secureToggle the eye button drives visibility; otherwise honor the prop as-is.
  const effectiveSecure = secureToggle ? secureTextEntry === true && !revealed : secureTextEntry;

  const field = (
    <TextInput
      ref={ref}
      placeholderTextColor={tokens.textMuted}
      {...props}
      secureTextEntry={effectiveSecure}
      multiline={multiline}
      style={[
        styles.input,
        compact && { minHeight: 32, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, includeFontPadding: false },
        compact && fontsReady && { fontFamily: "LUXIPANEL-Inter" },
        multiline && styles.inputMultiline,
        {
          backgroundColor: compact ? tokens.bgPrimary : tokens.bgInput,
          borderColor: error ? tokens.danger : tokens.border,
          color: tokens.textSecondary,
          direction,
          textAlign: props.textAlign ?? getLocaleTextAlign(language),
        },
        secureToggle && styles.inputWithReveal,
        props.style,
      ]}
    />
  );

  return (
    <View style={[styles.wrap, { direction }]}>
      {label ? (
        <Text style={[styles.label, compact && { fontWeight: "500", letterSpacing: 0 }, { color: tokens.textMuted, textAlign: getLocaleTextAlign(language) }]}>{label}</Text>
      ) : null}
      {secureToggle ? (
        <View style={styles.revealWrap}>
          {field}
          <Pressable
            accessibilityRole="button"
            onPress={() => setRevealed((v) => !v)}
            disabled={props.editable === false}
            hitSlop={8}
            style={styles.revealBtn}
          >
            {revealed
              ? <EyeOff size={18} color={tokens.textMuted} />
              : <Eye size={18} color={tokens.textMuted} />}
          </Pressable>
        </View>
      ) : field}
      {hint ? <Text style={[styles.hint, { color: tokens.textMuted, textAlign: getLocaleTextAlign(language) }]}>{hint}</Text> : null}
      {error ? <Text style={[styles.error, { color: tokens.danger, textAlign: getLocaleTextAlign(language) }]}>{error}</Text> : null}
    </View>
  );
});
