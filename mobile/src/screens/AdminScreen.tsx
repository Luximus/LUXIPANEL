import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { ScopedNativeModal as RNModal } from "./main/native-module-context";;
import { styles } from "./AdminScreen.styles";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Users as UsersIcon, ShieldCheck, Package, Boxes, BookText, BookOpen } from "lucide-react-native";
import { ENV } from "../config/env";
import { BlogSection } from "./BlogScreen";
import { getMessages, getLocaleTextAlign } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { UsersSection } from "./admin-users";
import { RolesSection } from "./admin-roles";
import { ProductsSection } from "./admin-products";
import { ModulesSection } from "./admin-modules";

type Section = "hub" | "users" | "roles" | "products" | "modules" | "blog";

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla de administración (solo admins). Hub con 4 superficies portadas del
// portal web: Usuarios, Roles, Productos (Wompi) y Módulos premium. Cada una es
// una lista de tarjetas + modal crear/editar (validación con focus al campo
// inválido y borde rojo) + modal de confirmación para borrar.
// ─────────────────────────────────────────────────────────────────────────────

export function AdminScreen({
  visible,
  onClose,
  token,
  language,
}: {
  visible: boolean;
  onClose: () => void;
  token: string;
  language: string;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const messages = getMessages(language);
  const t = messages.admin;
  const tb = getMessages(language).blog;
  const textAlign = getLocaleTextAlign(language);
  const [section, setSection] = useState<Section>("hub");
  const { width } = useWindowDimensions();

  // Al abrir, vuelve siempre al hub.
  useEffect(() => {
    if (visible) setSection("hub");
  }, [visible]);

  const hubItems = useMemo(
    () => [
      { key: "users" as Section, icon: <UsersIcon size={20} />, label: t.sectionUsers, desc: t.usersDesc, tint: tokens.brand },
      { key: "roles" as Section, icon: <ShieldCheck size={20} />, label: t.sectionRoles, desc: t.rolesDesc, tint: "#34d399" },
      { key: "products" as Section, icon: <Package size={20} />, label: t.sectionProducts, desc: t.productsDesc, tint: "#f59e0b" },
      { key: "modules" as Section, icon: <Boxes size={20} />, label: t.sectionModules, desc: t.modulesDesc, tint: "#8b5cf6" },
      { key: "blog" as Section, icon: <BookText size={20} />, label: tb.sectionBlog, desc: tb.blogDesc, tint: "#ec4899" },
    ],
    [t, tb, tokens.brand],
  );

  const headerTitle = section === "hub"
    ? t.title
    : section === "users" ? t.usersTitle
    : section === "roles" ? t.rolesTitle
    : section === "products" ? t.productsTitle
    : section === "blog" ? tb.blogTitle
    : t.modulesTitle;

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={() => (section === "hub" ? onClose() : setSection("hub"))}>
      <View style={styles.drawerOverlay}>
        <Pressable style={styles.drawerBackdrop} onPress={onClose} accessibilityLabel={t.back} />
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={[styles.drawerPanel, { width: Math.min(width * 0.94, 560), backgroundColor: tokens.bgPrimary, borderLeftColor: tokens.border }]}>
        <View style={[styles.header, { borderBottomColor: tokens.border, borderLeftColor: tokens.brandLight, backgroundColor: tokens.bgCardSolid }]}>
          <View style={[styles.headerIcon, { backgroundColor: tokens.brandDim, borderColor: tokens.border }]}>
            <ShieldCheck size={21} color={tokens.brandLight} />
          </View>
          <View style={styles.headerHeading}>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: tokens.textPrimary }]}>{t.title}</Text>
            {section !== "hub" ? <Text numberOfLines={1} style={[styles.headerSubtitle, { color: tokens.textMuted }]}>{headerTitle}</Text> : null}
          </View>
          <Pressable
            onPress={() => (section === "hub" ? onClose() : setSection("hub"))}
            style={[styles.headerBtn, { borderColor: tokens.border, backgroundColor: tokens.bgPrimary }]}
            accessibilityLabel={t.back}
          >
            <ChevronLeft size={22} color={tokens.textPrimary} />
          </Pressable>
        </View>

        {section === "hub" ? (
          <ScrollView contentContainerStyle={styles.hubContent}>
            <Text style={[styles.hubSubtitle, { color: tokens.textMuted, textAlign }]}>{t.subtitle}</Text>
            {hubItems.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setSection(item.key)}
                style={[styles.hubCard, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}
              >
                <View style={[styles.hubIcon, { backgroundColor: `${item.tint}22` }]}>
                  {React.cloneElement(item.icon, { color: item.tint })}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hubLabel, { color: tokens.textPrimary, textAlign }]}>{item.label}</Text>
                  <Text style={[styles.hubDesc, { color: tokens.textMuted, textAlign }]}>{item.desc}</Text>
                </View>
                <ChevronRight size={18} color={tokens.textMuted} />
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="link"
              onPress={() => { void Linking.openURL(`${ENV.luxipanelUrl.replace(/\/+$/, "")}/documentation`).catch(() => {}); }}
              style={[styles.hubCard, { backgroundColor: tokens.bgCard, borderColor: tokens.border }]}
            >
              <View style={[styles.hubIcon, { backgroundColor: tokens.brandDim }]}><BookOpen size={20} color={tokens.brandLight} /></View>
              <Text style={[styles.hubLabel, { flex: 1, color: tokens.textPrimary, textAlign }]}>{messages.account.documentation}</Text>
              <ChevronRight size={18} color={tokens.textMuted} />
            </Pressable>
          </ScrollView>
        ) : null}

        {section === "users" ? <UsersSection token={token} language={language} tokens={tokens} /> : null}
        {section === "roles" ? <RolesSection token={token} language={language} tokens={tokens} /> : null}
        {section === "products" ? <ProductsSection token={token} language={language} tokens={tokens} /> : null}
        {section === "modules" ? <ModulesSection token={token} language={language} tokens={tokens} /> : null}
        {section === "blog" ? <BlogSection token={token} language={language} tokens={tokens} /> : null}
        </SafeAreaView>
      </View>
    </RNModal>
  );
}
