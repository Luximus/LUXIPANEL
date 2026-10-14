import { FormDrawer } from "../ui/FormDrawer";
import { useConfirmation } from "../ui/useConfirmation";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Bot, Pencil, Plus, Trash2, Users } from "lucide-react-native";
import { luxAssistantProxy } from "../../api/client";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { PROVIDER_MODELS, PROVIDER_ORDER, ProviderIcon } from "../ProviderIcon";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { s } from "./styles";
import { SectionHead, LoadState } from "./parts";
import type { AssistantAgent, AgentRole, AssistantProviderId } from "./types";

type T = Messages["assistantSettings"];

type Draft = {
  id?: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  model: string;
  roleId: string | null;
  parentAgentId: string | null;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  systemPrompt: "",
  providerId: "claude",
  model: "",
  roleId: null,
  parentAgentId: null,
};

/**
 * Sub-tab "Agentes": lista de agentes IA + roles reutilizables, con jerarquía
 * (subordinación) y conexiones reflejadas como badges. Crear/editar/eliminar
 * contra `/api/ai/agents` y `/api/ai/agent-roles` por el túnel SSO.
 */
export function AgentsSubTab({
  panelId,
  token,
  language,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  language: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const [agents, setAgents] = useState<AssistantAgent[] | null>(null);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [roleEditing, setRoleEditing] = useState<{ id?: string; name: string; description: string; systemPrompt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = React.useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    void Promise.all([
      luxAssistantProxy<{ agents?: AssistantAgent[] }>(panelId, token, "GET", "/api/ai/agents"),
      luxAssistantProxy<{ roles?: AgentRole[] }>(panelId, token, "GET", "/api/ai/agent-roles"),
    ]).then(([ag, ro]) => {
      if (cancelled) return;
      if (!ag) { setStatus("error"); return; }
      setAgents(Array.isArray(ag.agents) ? ag.agents : []);
      setRoles(Array.isArray(ro?.roles) ? ro!.roles : []);
      setStatus("ready");
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  useEffect(() => load(), [load]);

  const saveAgent = async () => {
    if (!editing || busy) return;
    if (!editing.name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: editing.name.trim(),
        description: editing.description.trim(),
        systemPrompt: editing.systemPrompt.trim(),
        providerId: editing.providerId,
        model: editing.model.trim() || (PROVIDER_MODELS[editing.providerId]?.[0] ?? ""),
        allowedTools: null,
        roleId: editing.roleId,
        parentAgentId: editing.parentAgentId,
      };
      if (editing.id) {
        await luxAssistantProxy(panelId, token, "PUT", `/api/ai/agents/${editing.id}`, payload);
      } else {
        await luxAssistantProxy(panelId, token, "POST", "/api/ai/agents", payload);
      }
      setEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const removeAgent = async (id: string) => {
    setBusy(true);
    try {
      await luxAssistantProxy(panelId, token, "DELETE", `/api/ai/agents/${id}`);
      load();
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async () => {
    if (!roleEditing || busy || !roleEditing.name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: roleEditing.name.trim(),
        description: roleEditing.description.trim(),
        systemPrompt: roleEditing.systemPrompt.trim(),
        allowedTools: null,
      };
      if (roleEditing.id) {
        await luxAssistantProxy(panelId, token, "PUT", `/api/ai/agent-roles/${roleEditing.id}`, payload);
      } else {
        await luxAssistantProxy(panelId, token, "POST", "/api/ai/agent-roles", payload);
      }
      setRoleEditing(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const removeRole = async (id: string) => {
    setBusy(true);
    try {
      await luxAssistantProxy(panelId, token, "DELETE", `/api/ai/agent-roles/${id}`);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (status !== "ready" || !agents) {
    return <LoadState t={t} tokens={tokens} mode={status === "error" ? "error" : "loading"} onRetry={load} />;
  }

  const roleName = (id?: string | null) => roles.find((r) => r.id === id)?.name;
  const parentName = (id?: string | null) => agents.find((a) => a.id === id)?.name;

  const modelOptions = (pid: AssistantProviderId) =>
    (PROVIDER_MODELS[pid] ?? []).map((m) => ({ value: m, label: m }));

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} nestedScrollEnabled>
      <View style={s.rowBetween}>
        <SectionHead title={t.agentsTitle} desc={t.agentsDescription} tokens={tokens} />
        <Button size="sm" variant="primary" label={t.agentNew} icon={<Plus size={15} color="#fff" />} onPress={() => setEditing({ ...EMPTY_DRAFT })} />
      </View>

      {agents.length === 0 ? (
        <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{t.agentsEmpty}</Text>
        </View>
      ) : (
        agents.map((a) => (
          <View key={a.id} style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
            <View style={s.cardRow}>
              <View style={[s.iconBox, { backgroundColor: tokens.brandDim }]}>
                <Bot size={18} color={a.color || tokens.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>{a.name}</Text>
                {a.description ? (
                  <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={2}>{a.description}</Text>
                ) : null}
              </View>
            </View>

            <View style={s.rowStart}>
              <View style={[s.badge, { backgroundColor: tokens.bgSecondary, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                <ProviderIcon id={a.providerId} size={11} color={tokens.textSecondary} />
                <Text style={[s.badgeText, { color: tokens.textSecondary }]}>{a.model || a.providerId}</Text>
              </View>
              {roleName(a.roleId) ? (
                <View style={[s.badge, { backgroundColor: tokens.brandDim }]}>
                  <Text style={[s.badgeText, { color: tokens.brand }]}>{`${t.agentBadgeRole}: ${roleName(a.roleId)}`}</Text>
                </View>
              ) : null}
              {parentName(a.parentAgentId) ? (
                <View style={[s.badge, { backgroundColor: tokens.bgSecondary, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                  <Users size={11} color={tokens.textMuted} />
                  <Text style={[s.badgeText, { color: tokens.textMuted }]}>{parentName(a.parentAgentId)}</Text>
                </View>
              ) : null}
              {a.connections && a.connections.length > 0 ? (
                <View style={[s.badge, { backgroundColor: tokens.bgSecondary }]}>
                  <Text style={[s.badgeText, { color: tokens.textMuted }]}>{`${t.agentBadgeConnections}: ${a.connections.length}`}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.actionsRow}>
              <Button
                size="sm"
                variant="ghost"
                label={t.edit}
                icon={<Pencil size={14} color={tokens.textSecondary} />}
                onPress={() => setEditing({
                  id: a.id,
                  name: a.name,
                  description: a.description,
                  systemPrompt: a.systemPrompt,
                  providerId: a.providerId,
                  model: a.model,
                  roleId: a.roleId ?? null,
                  parentAgentId: a.parentAgentId ?? null,
                })}
              />
              <DeleteButton t={t} tokens={tokens} confirmText={t.agentDeleteConfirm} disabled={busy} onConfirm={() => void removeAgent(a.id)} />
            </View>
          </View>
        ))
      )}

      {/* Roles */}
      <View style={[s.divider, { backgroundColor: tokens.border, marginVertical: 6 }]} />
      <View style={s.rowBetween}>
        <SectionHead title={t.rolesTitle} desc={t.rolesDescription} tokens={tokens} />
        <Button size="sm" variant="ghost" label={t.roleNew} icon={<Plus size={15} color={tokens.brand} />} onPress={() => setRoleEditing({ name: "", description: "", systemPrompt: "" })} />
      </View>
      {roles.length === 0 ? (
        <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{t.rolesEmpty}</Text>
        </View>
      ) : (
        roles.map((r) => (
          <View key={r.id} style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
            <View style={s.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>{r.name}</Text>
                {r.description ? <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={2}>{r.description}</Text> : null}
              </View>
            </View>
            <View style={s.actionsRow}>
              <Button size="sm" variant="ghost" label={t.edit} icon={<Pencil size={14} color={tokens.textSecondary} />} onPress={() => setRoleEditing({ id: r.id, name: r.name, description: r.description, systemPrompt: r.systemPrompt })} />
              <DeleteButton t={t} tokens={tokens} confirmText={t.roleDeleteConfirm} disabled={busy} onConfirm={() => void removeRole(r.id)} />
            </View>
          </View>
        ))
      )}

      {/* Modal de agente */}
      <FormDrawer
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? t.edit : t.agentNew}
        language={language}
        footer={
          <View style={s.actionsRow}>
            <Button size="sm" variant="ghost" label={t.cancel} onPress={() => setEditing(null)} />
            <Button size="sm" variant="primary" label={t.save} loading={busy} disabled={busy || !editing?.name.trim()} onPress={() => void saveAgent()} />
          </View>
        }
      >
        {editing ? (
          <View style={s.formGap}>
            <Field label={t.agentName} tokens={tokens}>
              <Input value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} placeholder={t.agentNamePlaceholder} />
            </Field>
            <Field label={t.agentDescription} tokens={tokens}>
              <Input value={editing.description} onChangeText={(v) => setEditing({ ...editing, description: v })} placeholder={t.agentDescriptionPlaceholder} />
            </Field>
            <Field label={t.agentPrompt} tokens={tokens}>
              <Input value={editing.systemPrompt} onChangeText={(v) => setEditing({ ...editing, systemPrompt: v })} placeholder={t.agentPromptPlaceholder} multiline />
            </Field>
            <Field label={t.agentProvider} tokens={tokens}>
              <Select
                value={editing.providerId}
                options={PROVIDER_ORDER.map((p) => ({ value: p, label: p }))}
                onChange={(v) => setEditing({ ...editing, providerId: v as AssistantProviderId, model: "" })}
              />
            </Field>
            <Field label={t.agentModel} tokens={tokens}>
              <Select
                value={editing.model}
                options={modelOptions(editing.providerId)}
                placeholder={t.agentModel}
                onChange={(v) => setEditing({ ...editing, model: v })}
              />
            </Field>
            <Field label={t.agentBadgeRole} tokens={tokens}>
              <Select
                value={editing.roleId ?? ""}
                options={[{ value: "", label: t.agentNone }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
                onChange={(v) => setEditing({ ...editing, roleId: v || null })}
              />
            </Field>
            <Field label={t.agentSubordinate} tokens={tokens}>
              <Select
                value={editing.parentAgentId ?? ""}
                options={[{ value: "", label: t.agentNone }, ...agents.filter((a) => a.id !== editing.id).map((a) => ({ value: a.id, label: a.name }))]}
                onChange={(v) => setEditing({ ...editing, parentAgentId: v || null })}
              />
            </Field>
          </View>
        ) : null}
      </FormDrawer>

      {/* Modal de rol */}
      <FormDrawer
        visible={roleEditing !== null}
        onClose={() => setRoleEditing(null)}
        title={roleEditing?.id ? t.edit : t.roleNew}
        language={language}
        footer={
          <View style={s.actionsRow}>
            <Button size="sm" variant="ghost" label={t.cancel} onPress={() => setRoleEditing(null)} />
            <Button size="sm" variant="primary" label={t.save} loading={busy} disabled={busy || !roleEditing?.name.trim()} onPress={() => void saveRole()} />
          </View>
        }
      >
        {roleEditing ? (
          <View style={s.formGap}>
            <Field label={t.roleName} tokens={tokens}>
              <Input value={roleEditing.name} onChangeText={(v) => setRoleEditing({ ...roleEditing, name: v })} placeholder={t.agentNamePlaceholder} />
            </Field>
            <Field label={t.agentDescription} tokens={tokens}>
              <Input value={roleEditing.description} onChangeText={(v) => setRoleEditing({ ...roleEditing, description: v })} placeholder={t.agentDescriptionPlaceholder} />
            </Field>
            <Field label={t.agentPrompt} tokens={tokens}>
              <Input value={roleEditing.systemPrompt} onChangeText={(v) => setRoleEditing({ ...roleEditing, systemPrompt: v })} placeholder={t.agentPromptPlaceholder} multiline />
            </Field>
          </View>
        ) : null}
      </FormDrawer>
    </ScrollView>
  );
}

function Field({ label, tokens, children }: { label: string; tokens: ThemeTokens; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

/** Confirmación de borrado sobre los ajustes, conservando su estado. */
function DeleteButton({
  t,
  tokens,
  confirmText,
  disabled,
  onConfirm,
}: {
  t: T;
  tokens: ThemeTokens;
  confirmText: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const { askConfirmation, confirmation } = useConfirmation();
  return <>
    {confirmation}
    <Button size="sm" variant="ghost" label={t.delete} icon={<Trash2 size={14} color={tokens.danger} />} disabled={disabled}
      onPress={() => askConfirmation(t.delete, confirmText, [
        { text: t.cancel, style: "cancel" },
        { text: t.delete, style: "destructive", onPress: onConfirm },
      ])} />
  </>;
}

export default AgentsSubTab;
