/** SvgLineChart — gráfico de líneas nativo con react-native-svg (ya enlazado por
 *  los iconos Tabler). Sin dependencia de charting nueva. Para el historial del
 *  Monitor (CPU/RAM/Disco %). */
import React from "react";
import Svg, { Line, Polyline } from "react-native-svg";

export type ChartSeries = { color: string; values: number[] };

export function SvgLineChart({
  width,
  height,
  series,
  maxY = 100,
  gridColor,
}: {
  width: number;
  height: number;
  series: ChartSeries[];
  maxY?: number;
  gridColor: string;
}) {
  const pad = 6;
  const w = Math.max(1, width - pad * 2);
  const h = Math.max(1, height - pad * 2);
  const toPoints = (vals: number[]) => {
    if (vals.length === 0) return "";
    return vals
      .map((v, i) => {
        const x = pad + (vals.length <= 1 ? w : (i / (vals.length - 1)) * w);
        const clamped = Math.min(maxY, Math.max(0, v));
        const y = pad + h - (clamped / maxY) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };
  return (
    <Svg width={width} height={height}>
      {[0, 25, 50, 75, 100].map((p) => {
        const y = pad + h - (p / 100) * h;
        return <Line key={p} x1={pad} y1={y} x2={pad + w} y2={y} stroke={gridColor} strokeWidth={0.5} />;
      })}
      {series.map((s, i) => (
        <Polyline key={i} points={toPoints(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </Svg>
  );
}
