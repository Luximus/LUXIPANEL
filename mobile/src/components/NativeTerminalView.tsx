// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Renderer NATIVO del emulador de terminal (`terminal-emulator.ts`). Pinta la
 * grilla cols×rows con texto SVG nativo colocado por columnas, un cursor de
 * bloque y el fondo del terminal. Sin layout de párrafos, wraps ni elipsis.
 *
 * Cada fila se memoiza por su `key` de contenido (la calcula el emulador): si la
 * fila no cambió entre repintados, su `<Text>` no se vuelve a renderizar. El
 * tamaño de celda lo calcula `NativeTerminalSession` a partir de la métrica de la
 * fuente monospace y se pasa aquí; la grilla queda alineada en una rejilla fija.
 */
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import {
  ANSI_DARK_PALETTE,
  ANSI_LIGHT_PALETTE,
  resolveAnsiColor,
} from "./ansi-parser";
import type { CursorState, RenderRow, RenderSpan } from "../lib/terminal-emulator";

export interface TerminalMetrics {
  /** Ancho de un carácter monospace (px). */
  cellWidth: number;
  /** Alto de una fila (px) = lineHeight. */
  cellHeight: number;
  fontSize: number;
  fontFamily?: string;
}

/** Resuelve fg/bg de un span (con inverse aplicado) a hex concretos. */
function resolveSpanColors(
  span: RenderSpan,
  palette: Record<string, string>,
  defaultFg: string,
  defaultBg: string,
): { color: string; background?: string } {
  let fg = resolveAnsiColor(span.fg, palette) ?? defaultFg;
  let bg = resolveAnsiColor(span.bg, palette);
  if (span.inverse) {
    const newFg = bg ?? defaultBg;
    const newBg = resolveAnsiColor(span.fg, palette) ?? defaultFg;
    fg = newFg;
    bg = newBg;
  }
  return { color: fg, background: bg };
}

const TermRow = React.memo(function TermRow({ row, metrics, palette, defaultFg, defaultBg, top }: {
  row: RenderRow; metrics: TerminalMetrics; palette: Record<string, string>; defaultFg: string; defaultBg: string; top: number;
}) {
  return <G>
    {row.spans.map((span, index) => {
      const { color, background } = resolveSpanColors(span, palette, defaultFg, defaultBg);
      const left = span.column * metrics.cellWidth;
      // The engine groups ASCII cells, and keeps Unicode graphemes separate.
      // Explicit glyph positions prevent bold/fallback font advances from
      // shifting later columns or making RN truncate the end of a Codex line.
      const x = /^[\x20-\x7e]+$/.test(span.text)
        ? Array.from(span.text, (_char, column) => left + column * metrics.cellWidth)
        : left;
      const width = span.columns * metrics.cellWidth;
      return <G key={index}>
        {background ? <Rect x={left} y={top} width={width} height={metrics.cellHeight} fill={background} /> : null}
        {!span.invisible && span.text.trim() ? <SvgText
          x={x} y={top + metrics.cellHeight / 2} alignmentBaseline="central"
          fontFamily={metrics.fontFamily ?? (Platform.OS === "ios" ? "Menlo" : "monospace")}
          fontSize={metrics.fontSize} fontWeight={span.bold ? "700" : "400"}
          fontStyle={span.italic ? "italic" : "normal"}
          fill={color} opacity={span.dim ? 0.65 : 1}
          fontVariantLigatures="none"
        >{span.text}</SvgText> : null}
        {!span.invisible && span.underline ? <Rect x={left} y={top + metrics.cellHeight - 2} width={width} height={1} fill={color} /> : null}
        {!span.invisible && span.strike ? <Rect x={left} y={top + metrics.cellHeight / 2} width={width} height={1} fill={color} /> : null}
      </G>;
    })}
  </G>;
}, (a, b) => a.row.key === b.row.key && a.top === b.top && a.metrics === b.metrics && a.defaultFg === b.defaultFg && a.defaultBg === b.defaultBg);

export function NativeTerminalView({
  rows,
  cursor,
  cols,
  rowCount,
  metrics,
  isDark,
}: {
  rows: RenderRow[];
  cursor: CursorState;
  cols: number;
  rowCount: number;
  metrics: TerminalMetrics;
  isDark: boolean;
}) {
  const palette = isDark ? ANSI_DARK_PALETTE : ANSI_LIGHT_PALETTE;
  const defaultFg = isDark ? "#e6edf3" : "#1f2937";
  const defaultBg = isDark ? "#0b1220" : "#f4f4f5";

  const gridWidth = cols * metrics.cellWidth;
  const gridHeight = rowCount * metrics.cellHeight;

  return (
    <View style={[styles.wrap, { width: gridWidth, height: gridHeight, backgroundColor: defaultBg }]}>
      <Svg width={gridWidth} height={gridHeight} pointerEvents="none">
      {rows.map((row, y) => (
        <TermRow
          key={y}
          row={row}
          metrics={metrics}
          palette={palette}
          defaultFg={defaultFg}
          defaultBg={defaultBg}
          top={y * metrics.cellHeight}
        />
      ))}
      </Svg>
      {cursor.visible && cursor.y < rowCount && cursor.x < cols ? (
        <View
          pointerEvents="none"
          style={[
            styles.cursor,
            {
              left: cursor.x * metrics.cellWidth,
              top: cursor.y * metrics.cellHeight,
              width: metrics.cellWidth,
              height: metrics.cellHeight,
              backgroundColor: isDark ? "rgba(167,139,250,0.7)" : "rgba(124,58,237,0.55)",
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", overflow: "hidden" },
  cursor: { position: "absolute", borderRadius: 1 },
});

export default NativeTerminalView;
