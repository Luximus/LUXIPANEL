import React, { useMemo } from "react";
import { Animated, Easing, StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import { useTheme } from "../../hooks/useTheme";

/**
 * Sistema de "skeletons" (placeholders animados) de la app. Se muestran mientras
 * los componentes que dependen de datos del servidor todavía no terminan de
 * cargar/sembrarse, para no enseñar un estado vacío/intermedio (que se veía como
 * una "versión antigua" del tab al abrir el drawer por primera vez).
 *
 * Todos los bloques laten en SINCRONÍA con un único driver de animación a nivel
 * de módulo (`pulse`): un solo `Animated.loop` alimenta el `opacity` de cualquier
 * número de bloques vía `interpolate`, así no se crea una animación por bloque.
 */

// Driver compartido: se arranca una sola vez (al montar el primer skeleton) y
// queda corriendo. Un único valor 0→1→0 que todos los bloques interpolan.
const pulse = new Animated.Value(0);
let pulseStarted = false;
function ensurePulse() {
  if (pulseStarted) return;
  pulseStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 760, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]),
  ).start();
}

const shimmerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

/** Color base del bloque según el tema (un tono por encima del fondo de la card). */
function skeletonColor(isDark: boolean): string {
  return isDark ? "rgba(120, 120, 132, 0.28)" : "rgba(15, 23, 42, 0.10)";
}

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Radio de las esquinas (px). Default 8. */
  radius?: number;
  style?: ViewStyle | ViewStyle[];
};

/** Bloque rectangular animado (la primitiva base). */
export function Skeleton({ width = "100%", height = 14, radius = 8, style }: SkeletonProps) {
  const { theme } = useTheme();
  ensurePulse();
  const color = skeletonColor(theme === "dark");
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: color, opacity: shimmerOpacity },
        style as ViewStyle,
      ]}
    />
  );
}

/** Círculo animado (avatares, iconos redondos). */
export function SkeletonCircle({ size = 36, style }: { size?: number; style?: ViewStyle | ViewStyle[] }) {
  return <Skeleton width={size} height={size} radius={size / 2} style={style} />;
}

export type SkeletonTextProps = {
  /** Nº de líneas. Default 1. */
  lines?: number;
  /** Alto de cada línea (px). Default 12. */
  lineHeight?: number;
  /** Espacio entre líneas (px). Default 7. */
  gap?: number;
  /** Ancho de la última línea (la demás van al 100%). Default "60%". */
  lastWidth?: DimensionValue;
  style?: ViewStyle | ViewStyle[];
};

/** Varias líneas de texto skeleton; la última más corta (como un párrafo real). */
export function SkeletonText({ lines = 1, lineHeight = 12, gap = 7, lastWidth = "60%", style }: SkeletonTextProps) {
  const widths = useMemo(
    () => Array.from({ length: lines }, (_, i) => (i === lines - 1 && lines > 1 ? lastWidth : "100%")),
    [lines, lastWidth],
  );
  return (
    <View style={[{ gap }, style as ViewStyle]}>
      {widths.map((w, i) => (
        <Skeleton key={i} width={w} height={lineHeight} radius={6} />
      ))}
    </View>
  );
}

/** Tarjeta skeleton genérica (borde + relleno) para envolver bloques. */
export function SkeletonCard({ children, style }: { children?: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: isDark ? "rgba(82, 82, 91, 0.45)" : "rgba(15, 23, 42, 0.08)",
          backgroundColor: isDark ? "rgba(76, 76, 76, 0.16)" : "rgba(255, 255, 255, 0.55)",
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
});
