import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { ScopedNativeModal as NativeModal } from "../screens/main/native-module-context";;
import { styles } from "./AccountMenu.styles";
import { BookOpen, ChevronRight, ExternalLink, LogOut, MessageCircle, Newspaper, Shield, UserPlus } from "lucide-react-native";
import { getCurrentCustomer } from "../api/client";
import { useAuth } from "../context/useAuth";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { ENV } from "../config/env";
import type { ThemeMode } from "../features/app/types";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";
import { ThemeToggle } from "./ui/ThemeToggle";
import { Avatar } from "./ui/Avatar";
import { AdminScreen } from "../screens/AdminScreen";
import type { SavedAccount } from "../storage/savedAccounts";

/** Sección a enfocar al abrir el menú de cuenta. `menu` muestra el dropdown
 *  (perfiles + items); el resto abre directamente su modal (deep-link del
 *  asistente / dashboard). */
export type AccountTab = "menu" | "info" | "security" | "payments";

/**
 * Menú de cuenta de la app, espejo del dropdown de web/desktop: el avatar abre
 * un dropdown (cabecera de perfil + switcher de cuentas + items) y cada item
 * abre SU propio modal independiente o navega. Sustituye al antiguo modal único
 * con barra de pestañas. Mantén paridad con `desktop/src/components/AccountMenu.tsx`.
 */
export function AccountMenu({
  theme,
  toggleTheme,
  language,
  setLanguage,
  displayName,
  accountOpen,
  setAccountOpen,
  switchAccount,
  logout,
  onGoBlog,
  onGoServers,
  onOpenStore,
  initialTab,
}: {
  theme: ThemeMode;
  toggleTheme: () => void;
  language: string;
  setLanguage: (next: string) => void;
  displayName: string;
  accountOpen: boolean;
  setAccountOpen: (next: boolean) => void;
  switchAccount: () => Promise<void>;
  logout: () => Promise<void>;
  /** Abre el drawer de Bitácora en el tab indicado (Perfil por defecto). */
  onGoBlog?: (tab?: "store" | "profile" | "security" | "payments" | "blog") => void;
  /** Navega a la lista de servidores (dashboard). */
  onGoServers?: () => void;
  /** Abre el modal de Store (compras de datos/tokens). */
  onOpenStore?: () => void;
  /** Sección a enfocar al abrir (menu por defecto). */
  initialTab?: AccountTab;
}) {
  const t = getMessages(language);
  const tokens = getThemeTokens(theme === "dark");
  const { token, userEmail, savedAccounts, loginWithSavedAccount } = useAuth();

  // Visibilidad del dropdown y de cada modal de sección. `accountOpen` (del
  // controlador) representa "UI de cuenta activa"; el efecto de ruteo decide
  // qué mostrar según `initialTab`.
  const [menuVisible, setMenuVisible] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const currentAccount = useMemo(
    () => (userEmail ? savedAccounts.find((entry) => entry.email === userEmail) ?? null : null),
    [savedAccounts, userEmail],
  );
  const otherAccounts = useMemo(
    () => savedAccounts.filter((entry) => entry.email !== userEmail),
    [savedAccounts, userEmail],
  );

  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const rtl = rowDirection === "row-reverse";

  // Ruteo al abrir: `menu` muestra el dropdown; los deep-links de sección
  // (info/seguridad/pagos) ya no abren modales — abren el drawer de Bitácora en el
  // tab correspondiente (Perfil/Seguridad/Pagos), donde ahora vive ese contenido.
  useEffect(() => {
    if (!accountOpen) {
      setMenuVisible(false);
      return;
    }
    if (initialTab === "security") { setMenuVisible(false); onGoBlog?.("security"); setAccountOpen(false); }
    else if (initialTab === "payments") { setMenuVisible(false); onGoBlog?.("payments"); setAccountOpen(false); }
    else if (initialTab === "info") { setMenuVisible(false); onGoBlog?.("profile"); setAccountOpen(false); }
    else { setMenuVisible(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountOpen, initialTab]);

  // Rol admin: resuelto al abrir el dropdown para gatear el item de Administración.
  useEffect(() => {
    if (!token) { setIsAdmin(false); setAdminOpen(false); return; }
    if (!menuVisible) return;
    let cancelled = false;
    void getCurrentCustomer(token).then((me) => {
      if (cancelled) return;
      const allowed = me?.role === "admin";
      setIsAdmin(allowed);
      if (!allowed) setAdminOpen(false);
    }).catch(() => { if (!cancelled) { setIsAdmin(false); setAdminOpen(false); } });
    return () => { cancelled = true; };
  }, [menuVisible, token]);

  // Cierra el dropdown sin descartar la UI de cuenta (se usa al elegir un item
  // que abre un modal de sección).
  const hideMenu = () => setMenuVisible(false);
  // Cierra TODA la UI de cuenta (dropdown + sección) → resetea el controlador.
  const closeAll = () => setAccountOpen(false);

  const whatsappHref = `https://api.whatsapp.com/send/?phone=%2B19295636472&text=${encodeURIComponent(getMessages(language).account.whatsappMessage)}&type=phone_number&app_absent=0`;
  const docsHref = `${ENV.luxipanelUrl}/documentation`;

  const pickAccount = (acct: SavedAccount) => {
    closeAll();
    void loginWithSavedAccount(acct).then((ok) => { if (!ok) void switchAccount(); });
  };

  return (
    <>
      {/* Dropdown de cuenta: card anclada abajo-derecha sobre un backdrop que
          cierra al tocar fuera (es un menú, no un formulario). */}
      <NativeModal visible={menuVisible} transparent animationType="fade" onRequestClose={closeAll}>
        <Pressable style={styles.menuBackdrop} onPress={closeAll}>
          <Pressable
            style={[styles.menuCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}
            onPress={() => {}}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Cabecera de perfil */}
              <View style={[styles.menuHeader, { flexDirection: rowDirection }]}>
                <Avatar photoURL={currentAccount?.photoURL ?? null} displayName={displayName} size={40} bordered={false} />
                <View style={styles.menuHeaderInfo}>
                  <Text numberOfLines={1} style={[styles.menuHeaderName, { color: tokens.textPrimary, textAlign }]}>{displayName}</Text>
                  <Text numberOfLines={1} style={[styles.menuHeaderEmail, { color: tokens.textMuted, textAlign }]}>{userEmail ?? "-"}</Text>
                </View>
              </View>

              {/* Switcher de OTRAS cuentas guardadas */}
              {otherAccounts.length > 0 ? (
                <>
                  <View style={[styles.menuDivider, { backgroundColor: tokens.border }]} />
                  {otherAccounts.map((acct) => {
                    const name = acct.displayName || acct.email.split("@")[0] || acct.email;
                    return (
                      <Pressable key={acct.uid} onPress={() => pickAccount(acct)} style={[styles.switchRow, { flexDirection: rowDirection }]}>
                        <Avatar photoURL={acct.photoURL ?? null} displayName={name} size={30} bordered={false} />
                        <View style={styles.switchMeta}>
                          <Text numberOfLines={1} style={[styles.switchName, { color: tokens.textPrimary, textAlign }]}>{name}</Text>
                          <Text numberOfLines={1} style={[styles.switchEmail, { color: tokens.textMuted, textAlign }]}>{acct.email}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
              <Pressable onPress={() => { closeAll(); void switchAccount(); }} style={[styles.menuItem, { flexDirection: rowDirection }]}>
                <UserPlus size={16} color={tokens.brand} />
                <Text numberOfLines={1} style={[styles.menuItemLabel, { color: tokens.brand, textAlign }]}>{t.account.useAnotherAccount}</Text>
              </Pressable>

              <View style={[styles.menuDivider, { backgroundColor: tokens.border }]} />

              {/* Tienda/Perfil/Seguridad/Pagos viven ahora como tabs del drawer de
                  Bitácora (se abre con swipe o desde "Blog"); el dropdown solo deja
                  cuenta, Blog, documentación, soporte y admin. */}
              {onGoBlog ? (
                <MenuRow icon={<Newspaper />} label={t.blogfeed.screenTitle} onPress={() => { closeAll(); onGoBlog("blog"); }} tokens={tokens} rowDirection={rowDirection} textAlign={textAlign} rtl={rtl} />
              ) : null}
              <MenuRow icon={<BookOpen />} label={t.account.documentation} external onPress={() => { closeAll(); void Linking.openURL(docsHref).catch(() => {}); }} tokens={tokens} rowDirection={rowDirection} textAlign={textAlign} rtl={rtl} />
              <MenuRow icon={<MessageCircle />} label={t.account.whatsappSupport} external onPress={() => { closeAll(); void Linking.openURL(whatsappHref).catch(() => {}); }} tokens={tokens} rowDirection={rowDirection} textAlign={textAlign} rtl={rtl} />
              {isAdmin ? (
                <MenuRow icon={<Shield />} label={t.admin.menuEntry} onPress={() => { hideMenu(); closeAll(); setAdminOpen(true); }} tokens={tokens} rowDirection={rowDirection} textAlign={textAlign} rtl={rtl} />
              ) : null}

              <View style={[styles.menuDivider, { backgroundColor: tokens.border }]} />
              <View style={[styles.menuFooter, { flexDirection: rowDirection }]}>
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <Button
                  label={t.account.logout}
                  variant="danger"
                  size="sm"
                  icon={<LogOut size={15} />}
                  onPress={() => { closeAll(); void logout(); }}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </NativeModal>

      {/* Información/Seguridad/Pagos ya no son modales aquí: su contenido vive en
          los tabs del drawer de Bitácora. Los deep-links los enruta el efecto de
          arriba vía `onGoBlog`. */}

      {isAdmin && token ? (
        <AdminScreen
          visible={adminOpen}
          onClose={() => setAdminOpen(false)}
          token={token}
          language={language}
        />
      ) : null}
    </>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  tokens,
  rowDirection,
  textAlign,
  rtl,
  external,
}: {
  icon: React.ReactElement<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void;
  tokens: ReturnType<typeof getThemeTokens>;
  rowDirection: "row" | "row-reverse";
  textAlign: "left" | "right";
  rtl: boolean;
  external?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.menuItem, { flexDirection: rowDirection }]}>
      {React.cloneElement(icon, { size: 16, color: tokens.textSecondary })}
      <Text numberOfLines={1} style={[styles.menuItemLabel, { color: tokens.textPrimary, textAlign }]}>
        {label}
      </Text>
      {external ? (
        <ExternalLink size={14} color={tokens.textMuted} />
      ) : (
        <ChevronRight size={16} color={tokens.textMuted} style={rtl ? styles.chevronFlip : undefined} />
      )}
    </Pressable>
  );
}
