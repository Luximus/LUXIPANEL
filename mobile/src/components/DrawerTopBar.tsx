import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { SegmentedControl } from "./ui/SegmentedControl";

/**
 * Barra superior que "toma" el navbar mientras un drawer (izquierdo de Servidor o
 * derecho de Cuenta/Bitácora) está abierto. Muestra ÚNICAMENTE los tabs del drawer
 * (sin título ni botón de cerrar): así queda en UNA sola fila, a la misma altura
 * que la barra normal (`ChatTopBar`), y abrir el drawer NO desfasa el UI. El cierre
 * del drawer es por backdrop / swipe / botón atrás. La usan los dos drawers.
 */
export function DrawerTopBar({
  items,
  value,
  onChange,
}: {
  /** `language` se acepta (lo pasa MainScreen) pero el `SegmentedControl` resuelve
   *  su propia dirección RTL, así que aquí no se usa. */
  language?: string;
  items: { key: string; label: string; accent?: boolean }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  // Fade suave al aparecer, SIN desplazamiento vertical (fromY: 0) para no mover
  // nada de sitio: la barra solo aparece/desaparece, no se desliza.
  const enter = useEnterAnimation({ duration: 220, fromY: 0 });

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: tokens.bgPrimary, borderBottomColor: tokens.border },
        enter.style,
      ]}
    >
      <SegmentedControl scroll items={items} value={value} onChange={onChange} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // paddingVertical 11 + segmento (~34 alto) + borde 1 ≈ 57px = misma altura que
  // ChatTopBar (paddingVertical 8 + contenido 40 + borde 1), para no desfasar.
  bar: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    borderBottomWidth: 1,
  },
});
