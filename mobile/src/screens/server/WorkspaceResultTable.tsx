import { nativeText } from '../../i18n/native-text';
import React, { useMemo } from "react";
import { Text } from "react-native";
import { ServerDataTable, type ServerColumn } from "../../components/server/ServerDataTable";
import { getThemeTokens } from "../../theme/colors";
import { useTheme } from "../../hooks/useTheme";
/** Structured records use the same native sortable/paged table as Users and Files. */
export function WorkspaceResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const columns = useMemo(() => {
    const keys = [...new Set(rows.slice(0, 25).flatMap((row) => Object.keys(row)))]
      .filter((key) => rows.some((row) => row[key] == null || typeof row[key] !== "object"))
      .slice(0, 12);
    return keys.map((key) => ({
      id: key,
      header: key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "),
      width: 140,
      sortable: true,
      sortValue: (row: Record<string, unknown>) => String(row[key] ?? ""),
      cell: (row: Record<string, unknown>) => (
        <Text numberOfLines={3} selectable style={{ color: colors.textSecondary, fontSize: 13 }}>
          {typeof row[key] === "boolean" ? (row[key] ? "✓" : "—") : String(row[key] ?? "—")}
        </Text>
      ),
    })) as ServerColumn<Record<string, unknown>>[];
  }, [rows, colors]);
  return (
    <ServerDataTable
      title=""
      rows={rows}
      columns={columns}
      filters={[
        {
          id: "search",
          kind: "search",
          get placeholder() { return nativeText("Buscar"); },
          match: (row, q) =>
            Object.values(row).some((value) =>
              String(value ?? " ")
                .toLowerCase()
                .includes(q.toLowerCase()),
            ),
        },
      ]}
      rowKey={(row) => String(row.id ?? row.name ?? rows.indexOf(row))}
    />
  );
}
