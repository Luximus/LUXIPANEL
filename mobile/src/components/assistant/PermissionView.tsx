// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, ShieldAlert, X } from "lucide-react-native";
import type { PermissionReq } from "../../features/assistant/types";
import type { ThemeTokens } from "../../theme/colors";
import type { AssistantStrings } from "./types";
import { turnBoxStyles } from "./turn-box.styles";
import { styles } from "./PermissionView.styles";

/** Gate de permisos mid-run: caja ámbar con título + detalle + herramienta y 3
 *  botones (Aprobar / Aprobar y no preguntar más / Rechazar). Si ya no es el
 *  último turno (no interactivo) muestra un resumen apagado. */
export function PermissionView({
  request, interactive, t, tokens, onDecide,
}: {
  request: PermissionReq; interactive: boolean; t: AssistantStrings; tokens: ThemeTokens;
  onDecide: (decision: "allow" | "deny" | "always") => void | Promise<void>;
}) {
  const [sent, setSent] = useState<"allow" | "deny" | "always" | null>(null);
  const [error, setError] = useState("");
  const decide = (d: "allow" | "deny" | "always") => { if (sent) return; setSent(d); setError(""); void Promise.resolve().then(() => onDecide(d)).catch(() => { setSent(null); setError("No se pudo completar la respuesta."); }); };
  if (!interactive) {
    return (
      <View style={[turnBoxStyles.turnBox, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
        <View style={turnBoxStyles.turnBoxTitleRow}>
          <ShieldAlert size={14} color={tokens.textMuted} />
          <Text style={[turnBoxStyles.turnBoxTitle, { color: tokens.textSecondary }]}>{`${t.permRequestedPrefix ?? "El asistente pidió permiso para:"} ${request.title}`}</Text>
        </View>
        {request.detail ? <Text style={[styles.permDetail, { color: tokens.textMuted, borderColor: tokens.border }]}>{request.detail}</Text> : null}
      </View>
    );
  }
  return (
    <View style={[turnBoxStyles.turnBox, { borderColor: "rgba(251,191,36,0.45)", backgroundColor: "rgba(251,191,36,0.08)" }]}>
      <View style={turnBoxStyles.turnBoxTitleRow}>
        <ShieldAlert size={14} color={tokens.warning} />
        <Text style={[turnBoxStyles.turnBoxTitle, { color: tokens.textPrimary }]}>{t.permNeedsApproval ?? "El asistente necesita tu permiso para continuar"}</Text>
      </View>
      <Text style={[turnBoxStyles.askQuestionText, { color: tokens.textPrimary }]}>{request.title}</Text>
      {request.detail ? <Text selectable style={[styles.permDetail, { color: tokens.textSecondary, borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>{request.detail}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{color: tokens.danger}}>{error}</Text> : null}
      <Text style={[styles.permToolRow, { color: tokens.textMuted }]}>
        {`${t.permToolLabel ?? "Herramienta:"} `}
        <Text style={{ fontFamily: "monospace", color: tokens.textSecondary }}>{request.tool}</Text>
      </Text>
      <View style={styles.permBtnRow}>
        <Pressable onPress={() => decide("allow")} disabled={!!sent} style={[styles.permBtn, { backgroundColor: tokens.brand, borderColor: tokens.brand, opacity: sent ? 0.5 : 1 }]}>
          {sent === "allow" ? <ActivityIndicator size="small" color="#fff" /> : <Check size={13} color="#fff" />}
          <Text style={[styles.permBtnText, { color: "#fff" }]}>{t.permApprove ?? "Aprobar"}</Text>
        </Pressable>
        <Pressable onPress={() => decide("always")} disabled={!!sent} style={[styles.permBtn, { backgroundColor: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.5)", opacity: sent ? 0.5 : 1 }]}>
          {sent === "always" ? <ActivityIndicator size="small" color={tokens.success} /> : <Check size={13} color={tokens.success} />}
          <Text style={[styles.permBtnText, { color: tokens.success }]}>{t.permApproveAlways ?? "Aprobar y no preguntar más"}</Text>
        </Pressable>
        <Pressable onPress={() => decide("deny")} disabled={!!sent} style={[styles.permBtn, { backgroundColor: tokens.bgInput, borderColor: tokens.border, opacity: sent ? 0.5 : 1 }]}>
          {sent === "deny" ? <ActivityIndicator size="small" color={tokens.textMuted} /> : <X size={13} color={tokens.textMuted} />}
          <Text style={[styles.permBtnText, { color: tokens.textSecondary }]}>{t.permDeny ?? "Rechazar"}</Text>
        </Pressable>
      </View>
    </View>
  );
}
