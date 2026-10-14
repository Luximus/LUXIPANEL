import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Plus, Server, X } from "lucide-react-native";
import type { GuestEntry } from "../storage/guestHistory";
import { guestEntryKey } from "../storage/guestHistory";
import type { PanelRow } from "../features/app/viewModels";
import { getPanelHost, getPanelSubdomainLabel } from "../features/app/utils";
import { getLocaleRowDirection, getLocaleTextAlign } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";

/**
 * Tab "Conexiones a invitados" del drawer DERECHO en modo invitado. Reemplaza a los
 * tabs de cuenta (Perfil/Tienda/Comunidad), que no aplican a un invitado. Lista las
 * conexiones del invitado (subdominios / enlaces de invitación de `guestHistory`) como
 * TARJETAS con el nombre del servidor (subdominio); tocar una la enfoca en el carousel,
 * la X la quita, y el botón inferior abre el modal para añadir otra.
 */

const STR: Record<string, { title: string; empty: string; add: string; invitation: string }> = {
  es: { title: "Conexiones", empty: "Aún no tienes conexiones de invitado.", add: "Añadir conexión", invitation: "Invitación" },
  en: { title: "Connections", empty: "No guest connections yet.", add: "Add connection", invitation: "Invitation" },
  pt: { title: "Conexões", empty: "Você ainda não tem conexões de convidado.", add: "Adicionar conexão", invitation: "Convite" },
  fr: { title: "Connexions", empty: "Aucune connexion invité pour l'instant.", add: "Ajouter une connexion", invitation: "Invitation" },
  it: { title: "Connessioni", empty: "Nessuna connessione ospite ancora.", add: "Aggiungi connessione", invitation: "Invito" },
};
function strings(language?: string) { return STR[(language ?? "es").slice(0, 2)] ?? STR.es; }

function subdomainOf(entry: GuestEntry): string {
  return entry.subdomain ?? "";
}

export function GuestConnectionsPanel({ language, entries, panelRows, activePanelId, onSelect, onRemove, onAdd }: {
  language?: string;
  entries: GuestEntry[];
  panelRows: PanelRow[];
  /** Panel actualmente visible/activo en el carousel: su tarjeta se resalta. */
  activePanelId?: string | null;
  /** Tocar una conexión: panelId del panel del carousel (para enfocarlo), o null si la
   *  entrada aún no resolvió a un panel. */
  onSelect: (panelId: string | null) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const t = strings(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language ?? "es");
  const textAlign = getLocaleTextAlign(language ?? "es");

  // Etiqueta corta del host de la URL de acceso (customDomain) — managed
  // *.luxipanel.com retirado; cae al `accessSubdomain` legado si existe.
  const panelSubdomain = (p: PanelRow): string => {
    const label = getPanelSubdomainLabel(getPanelHost(p.source));
    return (label !== "-" ? label : "") || p.source.accessSubdomain || "";
  };

  // UNA tarjeta por SERVIDOR (panel del carousel), nunca el token crudo del enlace. Cada
  // panel se asocia a una entrada de guestHistory (para el botón Quitar):
  //   1) por SUBDOMINIO (conexiones por subdominio), y
  //   2) los paneles que queden sin emparejar toman, EN ORDEN, las entradas restantes
  //      (típicamente enlaces de invitación, que no traen subdominio) → un enlace = un
  //      servidor, sin duplicar ni mostrar el código pelado.
  // Solo las entradas que NO encajen en ningún panel (huérfanas: enlace inválido/pendiente)
  // se listan al final, con etiqueta legible, para poder quitarlas.
  type Item = { key: string; panelId: string | null; title: string; subdomain: string; removeKey: string | null };
  const usedKeys = new Set<string>();
  const items: Item[] = [];
  for (const p of panelRows) {
    const sub = panelSubdomain(p);
    const subLc = sub.trim().toLowerCase();
    let removeKey: string | null = null;
    if (subLc) {
      const e = entries.find((x) => !usedKeys.has(guestEntryKey(x)) && subdomainOf(x).trim().toLowerCase() === subLc);
      if (e) { removeKey = guestEntryKey(e); usedKeys.add(removeKey); }
    }
    items.push({ key: p.id, panelId: p.id, title: p.nameLabel || sub || t.invitation, subdomain: sub, removeKey });
  }
  // Paso 2: paneles sin emparejar ← entradas no usadas, en orden.
  const leftover = entries.filter((x) => !usedKeys.has(guestEntryKey(x)));
  let li = 0;
  for (const it of items) {
    if (!it.removeKey && li < leftover.length) {
      const k = guestEntryKey(leftover[li]); li++;
      it.removeKey = k; usedKeys.add(k);
    }
  }
  // Paso 3: entradas huérfanas (no resolvieron a ningún panel) → al final, etiqueta legible.
  for (const e of entries) {
    if (usedKeys.has(guestEntryKey(e))) continue;
    const sub = subdomainOf(e);
    const title = (e.kind === "access" ? e.label : null) || sub || t.invitation;
    items.push({ key: `e:${guestEntryKey(e)}`, panelId: null, title, subdomain: sub, removeKey: guestEntryKey(e) });
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Server size={28} color={tokens.textMuted} />
            <Text style={[styles.emptyText, { color: tokens.textMuted, textAlign }]}>{t.empty}</Text>
          </View>
        ) : items.map((it) => {
          // Conexión donde el usuario está AHORA (panel visible en el carousel): se
          // resalta con un tinte de marca (color distinto del resto) + borde de marca.
          const isActive = !!it.panelId && !!activePanelId && it.panelId === activePanelId;
          return (
            <View key={it.key} style={[styles.card, { borderColor: isActive ? tokens.brand : tokens.border, backgroundColor: isActive ? tokens.brandDim : tokens.bgCardSolid, flexDirection: rowDirection }]}>
              <Pressable style={[styles.cardMain, { flexDirection: rowDirection }]} onPress={() => onSelect(it.panelId)}>
                <View style={[styles.icon, { backgroundColor: isActive ? tokens.brand : tokens.bgInput }]}><Server size={16} color={isActive ? "#ffffff" : tokens.brand} /></View>
                <View style={styles.cardText}>
                  <Text numberOfLines={1} style={[styles.cardTitle, { color: isActive ? tokens.brand : tokens.textPrimary, textAlign }]}>{it.title}</Text>
                  {it.subdomain && it.subdomain !== it.title ? (
                    <Text numberOfLines={1} style={[styles.cardSub, { color: tokens.textMuted, textAlign }]}>{it.subdomain}</Text>
                  ) : null}
                </View>
              </Pressable>
              {it.removeKey ? (
                <Pressable hitSlop={8} style={styles.remove} onPress={() => onRemove(it.removeKey!)} accessibilityLabel="X">
                  <X size={16} color={tokens.textMuted} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <Pressable onPress={onAdd} style={({ pressed }) => [styles.addBtn, { backgroundColor: tokens.brand, opacity: pressed ? 0.9 : 1 }]}>
        <Plus size={18} color="#fff" />
        <Text style={styles.addText}>{t.add}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 14, gap: 12 },
  list: { gap: 10, paddingBottom: 8 },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 48 },
  emptyText: { fontSize: 13, maxWidth: 280 },
  card: { alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, gap: 10 },
  cardMain: { flex: 1, alignItems: "center", gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardSub: { fontSize: 12 },
  remove: { padding: 4 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  addText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
