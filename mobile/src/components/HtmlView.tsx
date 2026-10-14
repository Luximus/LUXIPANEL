// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Renderer RN del árbol de `lib/html-lite` (cuerpo de posts del blog, HTML
 * saneado por el backend). Reemplaza al WebView del lector: los MdBlock se
 * delegan en `BlockView` (mismo renderer del asistente), las imágenes se
 * pintan con <Image> midiendo su aspect-ratio real, y los embeds de video
 * (iframes YouTube/Vimeo) se convierten en una tarjeta que abre el video en
 * el navegador del sistema — sin webview.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Play } from "lucide-react-native";
import { parseBlogHtml, type HtmlBlock, type HtmlEmbedBlock, type HtmlImageBlock } from "../lib/html-lite";
import { embedWatchUrl } from "../lib/embed-url";
import { BlockView, type BaseStyle } from "./MarkdownView";
import type { ThemeTokens } from "../theme/colors";

export { embedWatchUrl } from "../lib/embed-url";

function ImageBlockView({ block, tokens, base }: { block: HtmlImageBlock; tokens: ThemeTokens; base: BaseStyle }) {
  // Aspect-ratio real de la imagen (default 16:9 mientras llega la medida).
  const [ratio, setRatio] = useState(16 / 9);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      block.src,
      (w, h) => { if (alive && w > 0 && h > 0) setRatio(w / h); },
      () => undefined,
    );
    return () => { alive = false; };
  }, [block.src]);
  return (
    <View style={styles.media}>
      <Image
        source={{ uri: block.src }}
        style={[styles.image, { aspectRatio: ratio, backgroundColor: tokens.bgInput }]}
        resizeMode="cover"
        accessibilityLabel={block.alt || undefined}
      />
      {block.caption ? (
        // El caption se mantiene centrado (neutral a la dirección); solo se
        // propaga writingDirection para que el bidi del texto pinte bien.
        <Text style={[styles.caption, { color: tokens.textMuted, fontSize: base.fontSize - 2, writingDirection: base.writingDirection }]}>
          {block.caption}
        </Text>
      ) : null}
    </View>
  );
}

function EmbedBlockView({ block, tokens, base }: { block: HtmlEmbedBlock; tokens: ThemeTokens; base: BaseStyle }) {
  const url = embedWatchUrl(block.src);
  const host = useMemo(() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }, [url]);
  // RTL: icono de play al lado derecho y textos alineados a la derecha.
  const rtl = base.writingDirection === "rtl";
  const textDir = { textAlign: base.textAlign, writingDirection: base.writingDirection } as const;
  return (
    <Pressable
      onPress={() => { void Linking.openURL(url).catch(() => undefined); }}
      style={[styles.embed, rtl ? styles.embedRtl : null, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}
      accessibilityRole="link"
    >
      <View style={[styles.embedPlay, { backgroundColor: tokens.brandDim, borderColor: tokens.borderBrand }]}>
        <Play size={16} color={tokens.brandLight} fill={tokens.brandLight} />
      </View>
      <View style={styles.embedTextWrap}>
        <Text style={[{ color: base.color, fontSize: base.fontSize, fontWeight: "600" }, textDir]} numberOfLines={2}>
          {block.title || host}
        </Text>
        <Text style={[{ color: tokens.textMuted, fontSize: base.fontSize - 2.5 }, textDir]} numberOfLines={1}>{host}</Text>
      </View>
    </Pressable>
  );
}

export function HtmlView({
  html,
  tokens,
  textColor,
  fontSize = 15.5,
  copyLabel,
  copiedLabel,
  textAlign,
  writingDirection,
}: {
  html: string;
  tokens: ThemeTokens;
  textColor?: string;
  fontSize?: number;
  copyLabel: string;
  copiedLabel: string;
  /** Alineación/dirección del locale (RTL): se propagan a TODOS los textos del
   *  cuerpo vía `base`. Opcionales: sin ellas el render queda como siempre. */
  textAlign?: "left" | "right";
  writingDirection?: "ltr" | "rtl";
}) {
  const blocks = useMemo<HtmlBlock[]>(() => parseBlogHtml(html), [html]);
  const color = textColor ?? tokens.textPrimary;
  // Identidad estable (igual que en `MarkdownView`): `BlockView` está memoizado
  // y un `base` nuevo en cada render anularía el memo.
  const base = useMemo<BaseStyle>(
    () => ({ color, fontSize, lineHeight: fontSize * 1.62, textAlign, writingDirection }),
    [color, fontSize, textAlign, writingDirection],
  );
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.t === "image") return <ImageBlockView key={i} block={b} tokens={tokens} base={base} />;
        if (b.t === "embed") return <EmbedBlockView key={i} block={b} tokens={tokens} base={base} />;
        return <BlockView key={i} block={b} tokens={tokens} base={base} copyLabel={copyLabel} copiedLabel={copiedLabel} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  media: { gap: 5, marginVertical: 2 },
  image: { width: "100%", borderRadius: 10 },
  caption: { textAlign: "center" },
  embed: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 2 },
  embedRtl: { flexDirection: "row-reverse" },
  embedPlay: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  embedTextWrap: { flex: 1, gap: 1 },
});

export default HtmlView;
