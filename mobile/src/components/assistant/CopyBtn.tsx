// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import type { AssistantStrings } from "./types";
import { styles } from "./CopyBtn.styles";

/** Botón "Copiar" por burbuja (paridad web `CopyButton`): copia el texto al
 *  portapapeles y muestra un "Copiado" transitorio. `color` adapta el tono a la
 *  burbuja (blanco sobre la de usuario, muted sobre la del asistente). */
export function CopyBtn({ text, t, color }: { text: string; t: AssistantStrings; color: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={async () => {
        try {
          await Clipboard.setStringAsync(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* portapapeles no disponible — silencioso */ }
      }}
      hitSlop={8}
      style={styles.bubbleActionBtn}
      accessibilityLabel={copied ? t.copied : t.copy}
    >
      {copied ? <Check size={12} color={color} /> : <Copy size={12} color={color} />}
      <Text style={[styles.bubbleActionText, { color }]}>{copied ? t.copied : t.copy}</Text>
    </Pressable>
  );
}
