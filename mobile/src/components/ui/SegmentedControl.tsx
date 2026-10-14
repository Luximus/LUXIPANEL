import React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { PanelText as Text } from "./PanelText";
import { useModuleUi } from "./ModuleUi";
// ScrollView de react-native-gesture-handler (NO el de "react-native") en la
// barra scrolleable: el drawer está envuelto por un `PanGestureHandler` (swipe de
// tabs, `handleServerDrawerSwipe` en MainScreen). El ScrollView de RN usa el
// sistema de responder JS y PIERDE ante ese gesto nativo, así que arrastrar la
// barra cambiaba el tab superior en vez de desplazarla. El ScrollView de RNGH es
// un gesto nativo que coordina con el Pan padre: al scrollear horizontalmente se
// queda el touch y el Pan no cicla los tabs. El tap sobre un segmento sigue OK.
import { ScrollView } from "react-native-gesture-handler";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleRowDirection } from "../../i18n";
import { loadSessionState } from "../../lib/session-state";
import { styles } from "./SegmentedControl.styles";

export type SegmentItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  /** Tab "auxiliar"/contextual (solo aparece al entrar a ciertas pantallas, p. ej.
   *  Terminal o Chat). En estado INACTIVO se pinta con un color alterno (tinte de
   *  marca + borde de marca) para que destaque de los tabs permanentes y se entienda
   *  que es un botón distinto. Activo mantiene el relleno de marca normal. */
  accent?: boolean;
};

/**
 * Canonical pill tab bar / segmented control. Replaces the per-screen hand-rolled
 * tab pills so every "tab row" (Security, Payments, modal tabs, …) shares one look:
 * pill radius, fontSize 13 / weight 700, brand fill when active.
 *
 * - `fill` makes each segment flex:1 (equal-width segmented control).
 * - `scroll` lays the segments out in a horizontal scroller (long tab rows).
 */
export function SegmentedControl({
  items,
  value,
  onChange,
  fill = false,
  scroll = false,
  showScrollIndicator = false,
  style,
}: {
  items: SegmentItem[];
  value: string;
  onChange: (key: string) => void;
  fill?: boolean;
  scroll?: boolean;
  /** Solo en `scroll`: muestra la barra de scroll horizontal como pista visible
   *  de que hay más tabs a los lados (útil en filas largas que no caben). */
  showScrollIndicator?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const compact = useModuleUi();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const rowDir = getLocaleRowDirection(language);

  const renderItem = (item: SegmentItem) => {
    const active = item.key === value;
    // Tab auxiliar inactivo: color alterno (tinte de marca + borde de marca + texto
    // de marca) para destacarlo de los tabs permanentes. Activo o no-auxiliar usan el
    // esquema normal (relleno de marca activo / tarjeta neutra inactivo).
    const accent = !!item.accent && !active;
    const bg = compact ? active ? tokens.bgSecondary : "transparent" : active ? tokens.brand : accent ? tokens.brandDim : tokens.bgCardSolid;
    const borderColor = compact ? active ? tokens.border : "transparent" : active ? tokens.brand : accent ? tokens.borderBrand : tokens.border;
    const fg = compact ? active ? tokens.textPrimary : tokens.textMuted : active ? tokens.accentText : accent ? tokens.brand : tokens.textSecondary;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={() => onChange(item.key)}
        style={[
          styles.seg,
          compact && { minHeight: 30, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, gap: 4 },
          fill && styles.segFill,
          {
            flexDirection: rowDir,
            backgroundColor: bg,
            borderColor,
          },
        ]}
      >
        {item.icon
          ? React.cloneElement(item.icon as React.ReactElement<{ color?: string }>, {
              color: fg,
            })
          : null}
        <Text style={[styles.segLabel, compact && { fontSize: 11, fontWeight: "500" }, { color: fg }]} numberOfLines={1}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={showScrollIndicator}
        // RN da a ScrollView un estilo base `flexGrow:1, flexShrink:1`, así que en
        // una columna flex (p. ej. el cuerpo del drawer) el scroller HORIZONTAL crece
        // hacia abajo y estira las píldoras (UI malformada). `flexGrow:0` lo deja a la
        // altura de su contenido (la fila de tabs), como una barra de tabs normal.
        style={styles.scrollOuter}
        contentContainerStyle={[styles.row, { flexDirection: rowDir }, style]}
      >
        {items.map(renderItem)}
      </ScrollView>
    );
  }

  return <View style={[styles.row, { flexDirection: rowDir }, style]}>{items.map(renderItem)}</View>;
}
