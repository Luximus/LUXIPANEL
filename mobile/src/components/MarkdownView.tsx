import React, { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import { parseMarkdownCached, type MdAlign, type MdBlock, type MdInline, type MdList, type MdTable } from "../lib/markdown-lite";
import type { ThemeTokens } from "../theme/colors";
// Idioma ACTIVO de la app (lo publica `ChatScreen`): el renderer se usa desde
// hojas que no reciben `lang` por props (TurnView → MarkdownView, HtmlView).
import { assistantChatMessages } from "./assistant/format";

/**
 * Renderer RN del árbol de `lib/markdown-lite` (gap crítico de la app: antes
 * el markdown del asistente se pintaba como texto plano). Texto con <Text>
 * anidados (bold/italic/strike/inline code/links), headings, listas •/n.,
 * blockquote con barra izquierda, hr y bloques de código como tarjeta oscura
 * monospace con etiqueta de lenguaje y botón Copiar (expo-clipboard) — espejo
 * del Markdown.tsx + CodeBlock de LUXIPANEL.
 *
 * PERF (chat a tirones mientras la IA escribe): el parseo va por
 * `parseMarkdownCached` (incremental: solo re-parsea el bloque a medias) y
 * tanto `base` como `BlockView` están memoizados, así que un token nuevo solo
 * re-renderiza el ÚLTIMO bloque — los ya escritos conservan la identidad de sus
 * objetos y React se los salta. Cambiar cualquiera de las tres piezas por una
 * versión que reconstruya objetos en cada render devuelve los tirones.
 */
export const MarkdownView = React.memo(function MarkdownView({
  text,
  tokens,
  textColor,
  fontSize = 13.5,
  copyLabel,
  copiedLabel,
}: {
  text: string;
  tokens: ThemeTokens;
  /** Color base del texto (depende de la burbuja); default textPrimary. */
  textColor?: string;
  fontSize?: number;
  copyLabel: string;
  copiedLabel: string;
}) {
  const blocks = useMemo(() => parseMarkdownCached(text), [text]);
  const color = textColor ?? tokens.textPrimary;
  // Identidad estable: si `base` se reconstruyera en cada render, el memo de
  // `BlockView` fallaría siempre (props nuevas) y no serviría de nada.
  const base = useMemo<BaseStyle>(
    () => ({ color, fontSize, lineHeight: fontSize * 1.45 }),
    [color, fontSize],
  );

  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} tokens={tokens} base={base} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      ))}
    </View>
  );
});

export type BaseStyle = {
  color: string;
  fontSize: number;
  lineHeight: number;
  /** Alineación/dirección opcionales (lector del blog en locales RTL). El chat
   *  del asistente no las pasa: sin ellas el render es idéntico al de siempre. */
  textAlign?: "left" | "right";
  writingDirection?: "ltr" | "rtl";
};

function renderInlines(nodes: MdInline[], tokens: ThemeTokens, base: BaseStyle, keyPrefix: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (n.t) {
      case "text":
        return <Text key={key}>{n.text}</Text>;
      case "code":
        return (
          <Text
            key={key}
            style={{
              fontFamily: "monospace",
              fontSize: base.fontSize * 0.88,
              color: base.color,
              backgroundColor: tokens.brandDim,
            }}
          >
            {` ${n.text} `}
          </Text>
        );
      case "link":
        return (
          <Text
            key={key}
            style={{ color: tokens.brandLight, textDecorationLine: "underline" }}
            onPress={() => { void Linking.openURL(n.href).catch(() => undefined); }}
          >
            {n.text}
          </Text>
        );
      case "bold":
        return <Text key={key} style={{ fontWeight: "700" }}>{renderInlines(n.children, tokens, base, key)}</Text>;
      case "italic":
        return <Text key={key} style={{ fontStyle: "italic" }}>{renderInlines(n.children, tokens, base, key)}</Text>;
      case "strike":
        return <Text key={key} style={{ textDecorationLine: "line-through" }}>{renderInlines(n.children, tokens, base, key)}</Text>;
      case "u":
        return <Text key={key} style={{ textDecorationLine: "underline" }}>{renderInlines(n.children, tokens, base, key)}</Text>;
      default:
        return null;
    }
  });
}

function ListView({ list, tokens, base, depth }: { list: MdList; tokens: ThemeTokens; base: BaseStyle; depth: number }) {
  // RTL (blog en árabe): fila invertida — el marcador/bullet va a la derecha,
  // pegado al contenido — y la sangría de listas anidadas pasa al lado derecho.
  const rtl = base.writingDirection === "rtl";
  const indent = depth > 0 ? 14 : 0;
  return (
    <View style={{ gap: 2, marginLeft: rtl ? 0 : indent, marginRight: rtl ? indent : 0 }}>
      {list.items.map((item, i) => (
        <View key={i}>
          <View style={[styles.listRow, rtl ? styles.listRowRtl : null]}>
            <Text style={[base, styles.listMarker, rtl ? styles.listMarkerRtl : null, { color: tokens.textMuted }]}>
              {list.ordered ? `${i + 1}.` : "•"}
            </Text>
            <Text style={[base, styles.listContent]}>{renderInlines(item.children, tokens, base, `li-${i}`)}</Text>
          </View>
          {item.nested ? <ListView list={item.nested} tokens={tokens} base={base} depth={depth + 1} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Tabla GFM nativa: cabecera resaltada + filas con bordes y alineación por
 *  columna (réplica del `<table>` GFM de la web). Scroll horizontal si la tabla
 *  excede el ancho disponible. */
function TableView({ table, tokens, base }: { table: MdTable; tokens: ThemeTokens; base: BaseStyle }) {
  const alignOf = (i: number): "left" | "center" | "right" => {
    const a: MdAlign = table.align[i] ?? null;
    return a ?? "left";
  };
  const cols = Math.max(table.header.length, ...table.rows.map((r) => r.length), 1);
  const cellStyle = { flex: 1, minWidth: 88, paddingHorizontal: 8, paddingVertical: 6, borderColor: tokens.border, borderRightWidth: 1 } as const;
  return (
    <View style={[mdTableStyles.wrap, { borderColor: tokens.border }]}>
      {/* Cabecera */}
      <View style={[mdTableStyles.row, { backgroundColor: tokens.bgInput, borderBottomColor: tokens.border }]}>
        {Array.from({ length: cols }).map((_, i) => (
          <View key={i} style={[cellStyle, i === cols - 1 ? { borderRightWidth: 0 } : null]}>
            <Text style={[base, { fontWeight: "700", textAlign: alignOf(i) }]}>
              {table.header[i] ? renderInlines(table.header[i], tokens, base, `th-${i}`) : ""}
            </Text>
          </View>
        ))}
      </View>
      {/* Filas */}
      {table.rows.map((row, r) => (
        <View
          key={r}
          style={[mdTableStyles.row, { borderBottomColor: tokens.border }, r === table.rows.length - 1 ? { borderBottomWidth: 0 } : null]}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <View key={i} style={[cellStyle, i === cols - 1 ? { borderRightWidth: 0 } : null]}>
              <Text style={[base, { textAlign: alignOf(i) }]}>
                {row[i] ? renderInlines(row[i], tokens, base, `td-${r}-${i}`) : ""}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function CodeBlockView({ lang, code, tokens, copyLabel, copiedLabel }: { lang: string; code: string; tokens: ThemeTokens; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  // Mermaid: render gráfico nativo es caro (necesitaría un motor SVG completo);
  // best-effort = mostrar el bloque etiquetado como diagrama (espejo del
  // fallback de la web cuando el render falla). Anotado en gaps.
  const isMermaid = (lang || "").toLowerCase() === "mermaid";
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };
  return (
    // Tarjeta de código estilo terminal: oscura SIEMPRE (también en tema claro),
    // como el CodeBlock de LUXIPANEL — un terminal no cambia con el tema.
    <View style={styles.codeBlock}>
      <View style={styles.codeHead}>
        <Text style={styles.codeLang}>{isMermaid ? assistantChatMessages().mermaidDiagram : (lang || "code")}</Text>
        <Pressable onPress={() => void copy()} hitSlop={8} style={styles.codeCopy} accessibilityLabel={copyLabel}>
          {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} color="#8b97a7" />}
          <Text style={[styles.codeCopyText, copied ? { color: "#34d399" } : null]}>{copied ? copiedLabel : copyLabel}</Text>
        </Pressable>
      </View>
      <Text selectable style={styles.codeBody}>{code}</Text>
    </View>
  );
}

/** Renderer de un MdBlock; exportado para que `HtmlView` (blog) lo reutilice.
 *
 *  MEMOIZADO: `parseMarkdownCached` conserva la IDENTIDAD de los bloques ya
 *  cerrados entre token y token, así que el memo superficial los deja intactos
 *  y solo se re-renderiza el bloque vivo (el último). Requisito: `base`,
 *  `tokens` y las etiquetas deben llegar con identidad estable. */
export const BlockView = React.memo(function BlockView({ block, tokens, base, copyLabel, copiedLabel }: { block: MdBlock; tokens: ThemeTokens; base: BaseStyle; copyLabel: string; copiedLabel: string }) {
  switch (block.t) {
    case "p":
      return (
        <Text style={base}>
          {block.lines.map((ln, j) => (
            <React.Fragment key={j}>
              {j > 0 ? "\n" : null}
              {renderInlines(ln, tokens, base, `p-${j}`)}
            </React.Fragment>
          ))}
        </Text>
      );
    case "heading": {
      const size = block.level <= 1 ? base.fontSize + 2.5 : block.level === 2 ? base.fontSize + 1.5 : base.fontSize + 0.5;
      return (
        <Text style={[base, { fontSize: size, lineHeight: size * 1.4, fontWeight: "700", marginTop: 4 }]}>
          {renderInlines(block.children, tokens, base, "h")}
        </Text>
      );
    }
    case "quote":
      return (
        // En RTL la barra de la cita pasa al lado derecho.
        <View
          style={[
            styles.quote,
            base.writingDirection === "rtl"
              ? [styles.quoteRtl, { borderRightColor: tokens.borderStrong }]
              : { borderLeftColor: tokens.borderStrong },
          ]}
        >
          <Text style={[base, { color: tokens.textMuted }]}>
            {block.lines.map((ln, j) => (
              <React.Fragment key={j}>
                {j > 0 ? "\n" : null}
                {renderInlines(ln, tokens, base, `q-${j}`)}
              </React.Fragment>
            ))}
          </Text>
        </View>
      );
    case "list":
      return <ListView list={block} tokens={tokens} base={base} depth={0} />;
    case "hr":
      return <View style={[styles.hr, { backgroundColor: tokens.border }]} />;
    case "table":
      return <TableView table={block} tokens={tokens} base={base} />;
    case "codeblock":
      return <CodeBlockView lang={block.lang} code={block.code} tokens={tokens} copyLabel={copyLabel} copiedLabel={copiedLabel} />;
    default:
      return null;
  }
});

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  listRow: { flexDirection: "row", gap: 6 },
  listRowRtl: { flexDirection: "row-reverse" },
  listMarker: { minWidth: 14, textAlign: "right" },
  listMarkerRtl: { textAlign: "left" },
  listContent: { flex: 1 },
  quote: { borderLeftWidth: 3, paddingLeft: 9, marginVertical: 2 },
  quoteRtl: { borderLeftWidth: 0, paddingLeft: 0, borderRightWidth: 3, paddingRight: 9 },
  hr: { height: 1, marginVertical: 6, alignSelf: "stretch" },
  // Paleta fija del bloque terminal (intencionalmente independiente del tema).
  codeBlock: { borderRadius: 8, overflow: "hidden", backgroundColor: "#0b0f15", borderWidth: 1, borderColor: "#232c38", marginVertical: 2 },
  codeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "#10161f" },
  codeLang: { color: "#8b97a7", fontSize: 10.5, fontFamily: "monospace", textTransform: "lowercase" },
  codeCopy: { flexDirection: "row", alignItems: "center", gap: 4 },
  codeCopyText: { color: "#8b97a7", fontSize: 10.5, fontWeight: "600" },
  codeBody: { color: "#d7dde6", fontSize: 12, lineHeight: 17, fontFamily: "monospace", padding: 9 },
});

const mdTableStyles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 8, overflow: "hidden", marginVertical: 2 },
  row: { flexDirection: "row", borderBottomWidth: 1 },
});

export default MarkdownView;
