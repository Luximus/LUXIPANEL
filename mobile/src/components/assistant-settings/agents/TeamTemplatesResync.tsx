import { FormDrawer } from "../../ui/FormDrawer";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Modo RESYNC del asistente de plantillas de equipo (extraído de
 * `TeamTemplatesModal.tsx`): compara un equipo ya creado con su plantilla y
 * crea los agentes que falten (`resync` + `applyMissing`). Los strings de
 * resync viven en `AgentsStrings.resync` (prop `str`).
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "../../ui/Button";
import { s } from "../styles";
import type { ThemeTokens } from "../../../theme/colors";
import type { TeamTemplateResyncResult } from "../types";
import type { AgentsStrings } from "./agents-i18n";
import { formatStr } from "./agents-i18n";
import { teamTemplatesApi } from "./agents-api";
import { CheckBox } from "./AgentGroupedChecklist";

export function ResyncView({
  visible,
  panelId,
  token,
  target,
  onApplied,
  onClose,
  tokens,
  str,
  language,
}: {
  visible: boolean;
  panelId: string;
  token: string;
  target: { templateId: string; rootAgentId: string; teamName?: string };
  onApplied: (createdIds: string[]) => void;
  onClose: () => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
  language?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TeamTemplateResyncResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(new Set());
    teamTemplatesApi
      .resync(panelId, token, target.templateId, target.rootAgentId)
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        // Pre-selecciona todos los faltantes.
        setSelected(new Set((r?.missing ?? []).map((m) => m.slotId)));
      })
      .catch(() => !cancelled && setError(str.errorPrefix.replace("{message}", "")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, panelId, token, target.templateId, target.rootAgentId, str.errorPrefix]);

  function toggle(slotId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  async function apply() {
    if (selected.size === 0 || applying) return;
    setApplying(true);
    setError(null);
    const res = await teamTemplatesApi.applyMissing(panelId, token, target.templateId, target.rootAgentId, [...selected]);
    setApplying(false);
    if (!res) {
      setError(str.errorPrefix.replace("{message}", ""));
      return;
    }
    onApplied(res.createdIds);
    onClose();
  }

  const title = formatStr(str.resync.modalTitle, { name: target.teamName ?? "" });
  const missing = result?.missing ?? [];
  const present = result?.present ?? [];
  const extra = result?.extra ?? [];

  return (
    <FormDrawer
      visible={visible}
      onClose={onClose}
      title={title}
      language={language}
      footer={
        <View style={[s.actionsRow, { flex: 1 }]}>
          <Button size="sm" variant="ghost" label={str.resync.close} onPress={onClose} disabled={applying} />
          {missing.length > 0 && !result?.markersMissing ? (
            <Button
              size="sm"
              variant="primary"
              label={applying ? str.resync.applying : str.resync.confirm}
              onPress={apply}
              loading={applying}
              disabled={selected.size === 0}
            />
          ) : null}
        </View>
      }
    >
      {loading ? (
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{str.resync.loading}</Text>
      ) : error ? (
        <Text style={[s.cardDesc, { color: tokens.danger }]}>{error}</Text>
      ) : result?.markersMissing ? (
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{str.resync.markersMissing}</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {/* Faltantes (seleccionables) */}
          <View style={{ gap: 6 }}>
            <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>
              {str.resync.missingHeading} · {missing.length}
            </Text>
            {missing.length === 0 ? (
              <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{str.resync.nothingMissing}</Text>
            ) : (
              missing.map((m) => (
                <Pressable
                  key={m.slotId}
                  onPress={() => toggle(m.slotId)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}
                >
                  <CheckBox on={selected.has(m.slotId)} tokens={tokens} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardDesc, { color: tokens.textSecondary, fontWeight: "700" }]} numberOfLines={1}>
                      {m.name}
                    </Text>
                    {m.description ? (
                      <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={2}>
                        {m.description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </View>

          {/* Presentes */}
          {present.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>
                {str.resync.presentHeading} · {present.length}
              </Text>
              {present.map((p) => (
                <Text key={p.agentId} style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={1}>
                  {p.name}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Añadidos a mano */}
          {extra.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>
                {str.resync.extraHeading} · {extra.length}
              </Text>
              <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{str.resync.extraNote}</Text>
              {extra.map((e) => (
                <Text key={e.agentId} style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={1}>
                  {e.name}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </FormDrawer>
  );
}
