/**
 * blog-shared — tipos y componentes compartidos por la sección Blog
 * (lista, editor y gestores de categorías/tags), extraídos sin cambio de
 * comportamiento: slug, badge, icono de acción, etiqueta de campo, caja de
 * error y modal de confirmación.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { styles } from "./BlogScreen.styles";
import { getMessages, getLocaleTextAlign } from "../i18n";
import { getThemeTokens } from "../theme/colors";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";

export type ThemeTokens = ReturnType<typeof getThemeTokens>;
export type Tab = "publish" | "categories" | "tags";

// Deriva un slug (path de la URL pública) a partir de un texto: minúsculas, sin
// acentos (NFD), runs de caracteres no [a-z0-9] colapsados a "-", sin "-" en los
// extremos y máximo 80 caracteres. Espeja la derivación del backend para la
// previsualización; el servidor sigue siendo la autoridad de unicidad.
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// ── Helpers compartidos (espejo de los de AdminScreen) ───────────────────────

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function ActionIcon({
  icon,
  color,
  onPress,
}: {
  icon: React.ReactElement<{ size?: number; color?: string }>;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.actionIcon}>
      {React.cloneElement(icon, { size: 17, color })}
    </Pressable>
  );
}

export function FieldLabel({ tokens, language, children }: { tokens: ThemeTokens; language: string; children: string }) {
  return (
    <Text style={[styles.fieldLabel, { color: tokens.textMuted, textAlign: getLocaleTextAlign(language) }]}>{children}</Text>
  );
}

export function FormError({ tokens, message }: { tokens: ThemeTokens; message: string }) {
  return (
    <View style={[styles.errorBox, { borderColor: tokens.danger, backgroundColor: tokens.bgSecondary }]}>
      <Text style={{ color: tokens.danger, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

export function ConfirmModal({
  state,
  language,
  tokens,
  onCancel,
  onConfirm,
}: {
  state: { open: boolean; title: string; message: string; busy: boolean };
  language: string;
  tokens: ThemeTokens;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = getMessages(language).blog;
  return (
    <Modal
      visible={state.open}
      onClose={onCancel}
      title={state.title}
      language={language}
      footer={
        <>
          <Button label={t.cancel} variant="ghost" onPress={onCancel} disabled={state.busy} />
          <Button label={t.delete} variant="danger" onPress={onConfirm} loading={state.busy} disabled={state.busy} />
        </>
      }
    >
      <Text style={{ color: tokens.textSecondary, fontSize: 14, lineHeight: 21 }}>{state.message}</Text>
    </Modal>
  );
}

