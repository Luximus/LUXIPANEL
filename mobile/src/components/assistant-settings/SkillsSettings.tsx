import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { s } from "./styles";
import { SectionHead } from "./parts";
import type { AssistantSkill } from "./types";

type T = Messages["assistantSettings"];

// Verde esmeralda del switch activo (paridad con el panel: los toggles de skills
// usan `emerald-500`, no el brand del servidor).
const SWITCH_ON_EMERALD = "#10b981";

/**
 * Habilidades (skills) GLOBALES del asistente. Réplica RN de `SkillsSettings` de
 * la web: cuadrícula de tarjetas + filtro de texto + selector de categoría. Las
 * skills son universales (aplican a cualquier proveedor), por eso viven como UNA
 * sección en la vista "Todos" de Proveedores (antes estaban en Accesos). Persiste
 * vía `GET /api/ai/skills` y `PUT /api/ai/skills/:id` ({ enabled, options }).
 */
export function SkillsSettings({
  panelId,
  token,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const [skills, setSkills] = useState<AssistantSkill[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    void luxAssistantProxy<{ skills?: AssistantSkill[] }>(panelId, token, "GET", "/api/ai/skills").then((body) => {
      if (!cancelled) setSkills(Array.isArray(body?.skills) ? body!.skills : []);
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  const update = async (id: string, patch: { enabled?: boolean; options?: Record<string, string> }) => {
    setBusyId(id);
    try {
      const res = await luxAssistantProxy<{ skills?: AssistantSkill[] }>(
        panelId, token, "PUT", `/api/ai/skills/${encodeURIComponent(id)}`, patch,
      );
      if (Array.isArray(res?.skills)) setSkills(res!.skills);
      else setSkills((cur) => cur?.map((x) => (x.id === id ? { ...x, ...patch } as AssistantSkill : x)) ?? cur);
    } finally {
      setBusyId(null);
    }
  };

  const categories = useMemo(() => {
    if (!skills) return [];
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const sk of skills) {
      if (!seen.has(sk.category)) {
        seen.add(sk.category);
        out.push({ id: sk.category, label: sk.categoryLabel || sk.category });
      }
    }
    return out;
  }, [skills]);

  const filtered = useMemo(() => {
    if (!skills) return [];
    const q = query.trim().toLowerCase();
    return skills.filter((sk) => {
      if (category !== "all" && sk.category !== category) return false;
      if (!q) return true;
      return (
        sk.name.toLowerCase().includes(q) ||
        sk.description.toLowerCase().includes(q) ||
        (sk.categoryLabel || "").toLowerCase().includes(q)
      );
    });
  }, [skills, query, category]);

  const tx = t.providersExtra;

  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
      <SectionHead title={tx.skillsTitle} desc={tx.skillsDesc} tokens={tokens} />

      {/* Barra de filtro: búsqueda + categoría. */}
      <Input value={query} onChangeText={setQuery} placeholder={tx.skillsSearch} autoCapitalize="none" autoCorrect={false} />
      <Select
        value={category}
        options={[{ value: "all", label: tx.skillsAllCategories }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
        onChange={setCategory}
      />

      {skills === null ? (
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{t.loading}</Text>
      ) : skills.length === 0 ? (
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tx.skillsEmpty}</Text>
      ) : filtered.length === 0 ? (
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tx.skillsNoMatch}</Text>
      ) : (
        <View style={sk.grid}>
          {filtered.map((skill) => {
            const busy = busyId === skill.id;
            return (
              <View
                key={skill.id}
                style={[sk.tile, { backgroundColor: tokens.bgSecondary, borderColor: skill.enabled ? SWITCH_ON_EMERALD : tokens.border }]}
              >
                <View style={sk.tileHead}>
                  <Text numberOfLines={2} style={[sk.tileTitle, { color: tokens.textPrimary }]}>{skill.name}</Text>
                  <Switch
                    value={skill.enabled}
                    disabled={busy}
                    onValueChange={(v) => void update(skill.id, { enabled: v })}
                    trackColor={{ false: tokens.border, true: SWITCH_ON_EMERALD }}
                    thumbColor="#ffffff"
                  />
                </View>
                <Text numberOfLines={2} style={[sk.tileDesc, { color: tokens.textMuted }]}>{skill.description}</Text>
                <View style={[sk.catBadge, { backgroundColor: tokens.bgInput }]}>
                  <Text style={[sk.catText, { color: tokens.textMuted }]}>{skill.categoryLabel || skill.category}</Text>
                </View>
                {skill.enabled && skill.options.length > 0 ? (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    {skill.options.map((opt) => (
                      <View key={opt.key}>
                        <Text style={[sk.optLabel, { color: tokens.textMuted }]}>{opt.label}</Text>
                        <Select
                          value={opt.value}
                          options={opt.choices.map((c) => ({ value: c.value, label: c.label }))}
                          onChange={(v) => void update(skill.id, { options: { [opt.key]: v } })}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const sk = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { flexGrow: 1, flexBasis: "46%", borderWidth: 1, borderRadius: 12, padding: 10, gap: 6 },
  tileHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
  tileTitle: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 },
  tileDesc: { fontSize: 10, lineHeight: 14 },
  catBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  optLabel: { fontSize: 10, fontWeight: "600", marginBottom: 3 },
});

export default SkillsSettings;
