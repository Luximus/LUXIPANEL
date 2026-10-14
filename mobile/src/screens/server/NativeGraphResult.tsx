import { nativeText } from '../../i18n/native-text';
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { NativeResult } from "./NativeOperationCard";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
/** Native symbols, source and relation diagram, using the existing graph query API. */
export function NativeGraphResult({
  value,
  tool,
  onCode,
  limit=25,
}: {
  limit?:number;
  value: unknown;
  tool: string;
  onCode: (name: string) => void;
}) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  if (tool === "get_code_snippet" && typeof data.source === "string")
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
          {String(data.name ?? data.qualified_name ?? "")}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {String(data.file_path ?? "")}:{String(data.start_line ?? "")}
        </Text>
        <ScrollView horizontal>
          <Text
            selectable
            style={{
              color: colors.textPrimary,
              fontFamily: "monospace",
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            {data.source}
          </Text>
        </ScrollView>
      </View>
    );
  if (tool === "get_architecture" && (data.total_nodes != null || data.total_edges != null))
    return (
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          ["Símbolos", data.total_nodes],
          ["Relaciones", data.total_edges],
        ].map(([label, count]) => (
          <View
            key={String(label)}
            style={{
              flex: 1,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText(String(label))}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "700" }}>
              {String(count ?? "—")}
            </Text>
          </View>
        ))}
      </View>
    );
  const records =
    tool === "search_graph"
      ? data.results
      : tool === "trace_path"
        ? [
            ...(Array.isArray(data.callers) ? data.callers : []),
            ...(Array.isArray(data.callees) ? data.callees : []),
          ]
        : null;
  if (Array.isArray(records))
    return (
      <View style={{ gap: 10 }}>
        {tool === "trace_path" && (
          <Svg
            height={Math.max(180, records.slice(0, 20).length * 38 + 70)}
            width="100%"
            viewBox={`0 0 300 ${Math.max(180, records.slice(0, 20).length * 38 + 70)}`}
            accessibilityLabel={nativeText("Relaciones entre funciones")}
          >
            {records.slice(0, 20).map((row, i) => (
              <React.Fragment key={i}>
                <Line x1={24} y1={30} x2={70} y2={65 + i * 38} stroke={colors.border} />
                <Circle cx={70} cy={65 + i * 38} r={4} fill={colors.brand} />
                <SvgText x={82} y={69 + i * 38} fill={colors.textSecondary} fontSize={10}>
                  {String(row.name ?? row.qualified_name ?? "").slice(0, 34)}
                </SvgText>
              </React.Fragment>
            ))}
            <Circle cx={24} cy={30} r={6} fill={colors.brand} />
            <SvgText x={38} y={34} fill={colors.textPrimary} fontSize={11}>
              {String(data.function ?? "").slice(0, 32)}
            </SvgText>
          </Svg>
        )}
        {records.slice(0,limit).map((row, index) => (
          <Pressable
            key={String(row.qualified_name ?? index)}
            disabled={!row.qualified_name}
            onPress={() => onCode(String(row.qualified_name))}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              gap: 5,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
              {String(row.name ?? row.qualified_name ?? "")}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {String(row.file_path ?? row.qualified_name ?? "")}
            </Text>
            {row.label ? (
              <Text style={{ color: colors.brand, fontSize: 11 }}>{String(row.label)}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    );
  return <NativeResult value={value} />;
}
