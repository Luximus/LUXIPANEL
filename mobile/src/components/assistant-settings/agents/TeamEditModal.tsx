import { FormDrawer } from "../../ui/FormDrawer";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TeamEditModal (RN) — crear o renombrar un equipo de agentes de primera clase.
 * Formulario simple: nombre (obligatorio), descripción y color. NO adjunta
 * agentes aquí (eso lo hace `TeamAddAgentsModal`), a diferencia del web que lo
 * fusionaba en un solo modal — la app separa ambas acciones.
 *
 * Es un componente CONTROLADO: no llama a la API. Valida en local (nombre no
 * vacío) y emite `onSave(payload)`; el padre (AgentsModule) hace el create/update
 * vía `agentTeamsApi`, controla `busy` y cierra al terminar. `credential`/`color`
 * viajan como NOMBRE de color (mismo contrato que el backend web: "violet"…).
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { s } from "../styles";
import type { ThemeTokens } from "../../../theme/colors";
import type { AgentTeam, AgentTeamPayload } from "../types";
import type { AgentsStrings } from "./agents-i18n";

/** Colores nombrados del equipo (mismo set que el web COLOR_DOT) → hex para RN.
 *  El payload guarda el NOMBRE, no el hex (contrato del backend). */
const TEAM_COLORS: { name: string; hex: string }[] = [
  { name: "violet", hex: "#8b5cf6" },
  { name: "blue", hex: "#3b82f6" },
  { name: "emerald", hex: "#10b981" },
  { name: "amber", hex: "#f59e0b" },
  { name: "red", hex: "#ef4444" },
  { name: "slate", hex: "#64748b" },
  { name: "cyan", hex: "#06b6d4" },
  { name: "pink", hex: "#ec4899" },
];

export function TeamEditModal({
  visible,
  team,
  busy,
  onSave,
  onClose,
  tokens,
  str,
  language,
}: {
  visible: boolean;
  /** Equipo a editar; omitir/null = modo creación. */
  team?: AgentTeam | null;
  busy?: boolean;
  onSave: (payload: AgentTeamPayload) => void;
  onClose: () => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
  language?: string;
}) {
  const editing = Boolean(team?.id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("violet");

  // Rehidrata el formulario cada vez que se abre / cambia el equipo objetivo.
  useEffect(() => {
    if (!visible) return;
    setName(team?.name ?? "");
    setDescription(team?.description ?? "");
    setColor(team?.color ?? "violet");
  }, [visible, team]);

  const trimmed = name.trim();

  function submit() {
    if (!trimmed || busy) return;
    const payload: AgentTeamPayload = {
      name: trimmed,
      description: description.trim() || undefined,
      color,
    };
    onSave(payload);
  }

  return (
    <FormDrawer
      visible={visible}
      onClose={onClose}
      title={editing ? str.teams.editTeamTitle : str.teams.newTeamTitle}
      language={language}
      footer={
        <View style={[s.actionsRow, { flex: 1 }]}>
          <Button size="sm" variant="ghost" label={str.teams.cancelBtn} onPress={onClose} disabled={busy} />
          <Button
            size="sm"
            variant="primary"
            label={editing ? str.teams.saveBtn : str.teams.createBtn}
            onPress={submit}
            loading={busy}
            disabled={!trimmed}
          />
        </View>
      }
    >
      <View style={s.formGap}>
        <Input
          label={str.teams.nameLabel}
          value={name}
          onChangeText={setName}
          placeholder={str.teams.namePlaceholder}
          maxLength={120}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Input
          label={str.teams.descriptionLabel}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{str.teams.colorLabel}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {TEAM_COLORS.map((c) => {
              const selected = color === c.name;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => setColor(c.name)}
                  accessibilityLabel={c.name}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c.hex,
                    borderWidth: selected ? 3 : 0,
                    borderColor: tokens.textPrimary,
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>
    </FormDrawer>
  );
}
