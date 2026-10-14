/**
 * server-table-cells — subcomponentes memoizados y constantes de estilo de
 * ServerDataTable, extraídos sin cambio de comportamiento. Todos a nivel de
 * MÓDULO (declararlos dentro del cuerpo del componente remonta el subárbol) y
 * memoizados con props estables (ver nota de rendimiento en ServerDataTable).
 */
import React, { useCallback, useMemo, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { PanelText as Text } from "../ui/PanelText";
import { PanelFontsReady } from "../ui/PanelText";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import type { TableMenuAnchor } from "./TableRowMenu";
import { MoreHorizontal } from "lucide-react-native";
import { withAlpha, type ThemeTokens } from "../../theme/colors";
import { Select } from "../ui/Select";
import type { ServerColumn, ServerRowAction, ServerSort } from "./server-table-logic";
import {
  TablerSelector,
  TablerChevronUp,
  TablerChevronDown,
  TablerDotsVertical,
  TablerCheck,
} from "../../features/app/tabler-icons";

// Dimensiones de layout de la tabla (compartidas con ServerDataTable).
export const ROW_H = 52;
export const HEAD_H = 40;
export const SELECT_W = 44;
export const ACTIONS_W = 52;
export const DEFAULT_COL_W = 150;

// ── Subcomponentes memoizados ────────────────────────────────────────────────
// Todos a nivel de MÓDULO: declararlos dentro del cuerpo de `ServerDataTable`
// crea un tipo nuevo por render y React remonta el subárbol entero.

export const Checkbox = React.memo(function Checkbox({
  on,
  onPress,
  tokens,
}: {
  on: boolean;
  onPress: () => void;
  tokens: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      hitSlop={8}
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: on ? tokens.brand : "transparent",
        borderColor: on ? tokens.brand : tokens.border,
      }}
    >
      {on ? <TablerCheck size={13} color="#ffffff" /> : null}
    </Pressable>
  );
});

/** Celda de selección (columna fija izquierda). `onToggle` recibe la clave. */
export const SelectCell = React.memo(function SelectCell({
  rowKey,
  on,
  onToggle,
  isLast,
  tokens,
  height = ROW_H,
}: {
  rowKey: string;
  on: boolean;
  onToggle: (key: string) => void;
  isLast: boolean;
  tokens: ThemeTokens;
  height?: number;
}) {
  const onPress = useCallback(() => onToggle(rowKey), [onToggle, rowKey]);
  return (
    <View style={[bodyCell, { height, borderBottomColor: tokens.border }, isLast && { borderBottomWidth: 0 }]}>
      <Checkbox on={on} onPress={onPress} tokens={tokens} />
    </View>
  );
});

type HeaderCellProps<Row> = {
  col: ServerColumn<Row>;
  sort: ServerSort;
  onPress: (col: ServerColumn<Row>) => void;
  tokens: ThemeTokens;
  compact?: boolean;
  height?: number;
};
function HeaderCellInner<Row>({ col, sort, onPress, tokens, compact, height = HEAD_H }: HeaderCellProps<Row>) {
  const sorted = sort?.id === col.id;
  const press = useCallback(() => onPress(col), [onPress, col]);
  return (
    <Pressable
      onPress={press}
      style={[
        headCell,
        {
          width: col.width ?? DEFAULT_COL_W,
          height,
          paddingHorizontal: compact ? (col.width ?? DEFAULT_COL_W) < 50 ? 8 : 14 : 12,
          borderBottomColor: tokens.border,
          backgroundColor: withAlpha(tokens.textMuted, 0.06),
          justifyContent: "flex-start",
          flexDirection: "row",
          gap: 4,
        },
      ]}
    >
      <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: compact ? 11 : 12, fontWeight: compact ? "400" : "600", flexShrink: 1 }}>
        {col.header}
      </Text>
      {col.sortable && col.sortValue && (!compact || (col.width ?? DEFAULT_COL_W) >= 50) ? (
        sorted ? (
          sort?.dir === "asc" ? (
            <TablerChevronUp size={13} color={tokens.brand} />
          ) : (
            <TablerChevronDown size={13} color={tokens.brand} />
          )
        ) : (
          <TablerSelector size={13} color={tokens.textMuted} />
        )
      ) : null}
    </Pressable>
  );
}
export const HeaderCell = React.memo(HeaderCellInner) as typeof HeaderCellInner;

/**
 * Fila de datos. Memoizada: mientras `row`, `columns` y `tokens` no cambien de
 * identidad no se vuelve a invocar `col.cell(row)` de cada columna (que es lo
 * que antes se recomputaba en CADA render de la pantalla, p. ej. en el poll de
 * 8 s del monitor o en cada tecla de la búsqueda).
 */
type DataRowProps<Row> = {
  row: Row;
  columns: ServerColumn<Row>[];
  onPress?: (row: Row) => void;
  isLast: boolean;
  tokens: ThemeTokens;
  cellTextStyle: { color: string; fontSize: number };
  compact?: boolean;
  height?: number;
};
function DataRowInner<Row>({ row, columns, onPress, isLast, tokens, cellTextStyle, compact, height = ROW_H }: DataRowProps<Row>) {
  const press = useCallback(() => onPress?.(row), [onPress, row]);
  return (
    <Pressable onPress={onPress ? press : undefined} style={{ flexDirection: "row" }}>
      {columns.map((col) => (
        <View
          key={col.id}
          style={[
            bodyCell,
            { width: col.width ?? DEFAULT_COL_W, height, paddingLeft: compact ? (col.width ?? DEFAULT_COL_W) < 50 ? 8 : 14 : 12, paddingRight: compact ? 6 : 12, borderBottomColor: tokens.border, alignItems: "flex-start", justifyContent: "center" },
            isLast && { borderBottomWidth: 0 },
          ]}
        >
          {renderCell(col.cell(row), cellTextStyle)}
        </View>
      ))}
    </Pressable>
  );
}
export const DataRow = React.memo(DataRowInner) as typeof DataRowInner;

/** Celda de acciones (columna fija derecha). */
type ActionCellProps<Row> = {
  row: Row;
  onPress: (row: Row) => void;
  isLast: boolean;
  tokens: ThemeTokens;
  compact?: boolean;
  height?: number;
  label?: string;
  onAnchor?: (row: Row, anchor: TableMenuAnchor) => void;
};
function ActionCellInner<Row>({ row, onPress, isLast, tokens, compact, height = ROW_H, label, onAnchor }: ActionCellProps<Row>) {
  const trigger = useRef<View>(null);
  const press = useCallback(() => {
    if (onAnchor && trigger.current) trigger.current.measureInWindow((x, y, width, measuredHeight) => onAnchor(row, { x, y, width, height: measuredHeight }));
    else onPress(row);
  }, [onPress, onAnchor, row]);
  return (
    <View style={[bodyCell, { height, borderBottomColor: tokens.border, alignItems: "center" }, isLast && { borderBottomWidth: 0 }]}>
      <Pressable ref={trigger} onPress={press} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
        {compact ? <MoreHorizontal size={16} color={tokens.textMuted} /> : <TablerDotsVertical size={18} color={tokens.textMuted} />}
      </Pressable>
    </View>
  );
}
export const ActionCell = React.memo(ActionCellInner) as typeof ActionCellInner;

export const RowActionItem = React.memo(function RowActionItem({
  action,
  onPress,
  tokens,
  compact = false,
}: {
  action: ServerRowAction;
  onPress: (actionId: string) => void;
  tokens: ThemeTokens;
  compact?: boolean;
}) {
  const press = useCallback(() => onPress(action.id), [onPress, action.id]);
  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: compact ? 40 : undefined,
        paddingVertical: compact ? 6 : 12,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderTopWidth: action.danger ? 1 : 0,
        borderTopColor: tokens.border,
        marginTop: action.danger ? 4 : 0,
      }}
    >
      {action.icon
        ? React.cloneElement(action.icon as React.ReactElement<{ color?: string }>, {
            color: action.danger ? tokens.danger : tokens.textSecondary,
          })
        : null}
      <Text style={{ color: action.danger ? tokens.danger : tokens.textPrimary, fontSize: compact ? 12 : 14, fontWeight: "500" }}>
        {action.label}
      </Text>
    </Pressable>
  );
});

type ColumnToggleProps<Row> = {
  col: ServerColumn<Row>;
  hidden: boolean;
  onToggle: (id: string) => void;
  tokens: ThemeTokens;
};
function ColumnToggleInner<Row>({ col, hidden, onToggle, tokens }: ColumnToggleProps<Row>) {
  const lockable = col.hideable === false;
  const press = useCallback(() => onToggle(col.id), [onToggle, col.id]);
  return (
    <Pressable
      disabled={lockable}
      onPress={press}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, opacity: lockable ? 0.5 : 1 }}
    >
      <Checkbox on={!hidden} onPress={noop} tokens={tokens} />
      <Text style={{ color: tokens.textSecondary, fontSize: 14 }}>{col.header}</Text>
    </Pressable>
  );
}
export const ColumnToggle = React.memo(ColumnToggleInner) as typeof ColumnToggleInner;

/** Select de filtro: envuelve `Select` para que `onChange` no sea inline. */
export const FilterSelect = React.memo(function FilterSelect({
  id,
  value,
  placeholder,
  allLabel,
  options,
  onChange,
  compact,
}: {
  id: string;
  value: string;
  placeholder: string;
  allLabel: string;
  options: { value: string; label: string }[];
  onChange: (id: string, value: string) => void;
  compact?: boolean;
}) {
  const opts = useMemo(() => [{ value: "", label: allLabel }, ...options], [allLabel, options]);
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const change = useCallback((v: string) => onChange(id, v), [onChange, id]);
  return <Select value={value} placeholder={placeholder} options={opts} onChange={change} compact={compact} showPlaceholderWhenEmpty={compact} style={compact ? { minHeight: 30, height: 30, borderRadius: 4, paddingVertical: 0, paddingHorizontal: 8, backgroundColor: tokens.bgPrimary } : undefined} />;
});

/** Si la celda devuelve string/number la envolvemos en <Text>; si es un nodo, tal cual. */
function renderCell(node: React.ReactNode, textStyle: { color: string; fontSize: number }): React.ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return (
      <Text numberOfLines={1} style={textStyle}>
        {node}
      </Text>
    );
  }
  return node;
}

/** Input de búsqueda sin label (controla su propio TextInput). */
export const SearchField = React.memo(function SearchField({
  id,
  value,
  onChange,
  placeholder,
  color,
  placeholderColor,
  compact,
}: {
  id: string;
  value: string;
  onChange: (id: string, value: string) => void;
  placeholder: string;
  color: string;
  placeholderColor: string;
  compact?: boolean;
}) {
  const change = useCallback((v: string) => onChange(id, v), [onChange, id]);
  const fontsReady = React.useContext(PanelFontsReady);
  const style = useMemo(() => ({ flex: 1, minWidth: 0, color, fontFamily: fontsReady ? "LUXIPANEL-Inter" : undefined, fontSize: compact ? 11 : 13, paddingVertical: 0 }), [color, compact, fontsReady]);
  return (
    <TextInput
      value={value}
      onChangeText={change}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      autoCapitalize="none"
      autoCorrect={false}
      style={style}
    />
  );
});

export function noop() {}

export const iconBtn = {
  width: 38,
  height: 38,
  borderRadius: 10,
  borderWidth: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

export const headCell = {
  paddingHorizontal: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderBottomWidth: 1,
};

const bodyCell = {
  paddingHorizontal: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderBottomWidth: 1,
};

export const pagerBtn = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 4,
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
};
