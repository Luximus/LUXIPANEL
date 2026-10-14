import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ScopedNativeModal as RNModal } from "../screens/main/native-module-context";;
import { Building2 } from "lucide-react-native";
import { getPublicProfile, type PublicProfile } from "../api/client";
import { getLocaleTextAlign } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { SegmentedControl } from "./ui/SegmentedControl";
import WorklogTab from "./account/WorklogTab";

type Tab = "profile" | "worklog";

function strings(language?: string) {
  return (language ?? "es").startsWith("en")
    ? { profile: "Profile", worklog: "Worklog", sharedBy: "Shared by", company: "Company" }
    : { profile: "Perfil", worklog: "Bitácora", sharedBy: "Compartido por", company: "Empresa" };
}

/**
 * Drawer izquierdo INDEPENDIENTE para ver el perfil PÚBLICO de otro usuario
 * (p. ej. quien te compartió un servidor). Dos tabs: Perfil (avatar/nombre/
 * empresa — SIN teléfono/correo/saldos) y Bitácora (worklog del usuario). Shell
 * propio (RNModal + slide desde la izquierda) para ser reutilizable en otras
 * vistas. Se cierra por backdrop o botón atrás.
 */
export default function PublicProfileDrawer({
  visible,
  onClose,
  userId,
  userName,
  token,
  language,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  /** Nombre inicial (del badge) mientras carga el perfil. */
  userName?: string;
  token: string;
  language?: string;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const textAlign = getLocaleTextAlign(language);
  const s = strings(language);
  const { width } = useWindowDimensions();
  const drawerWidth = Math.round(width * 0.86);

  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setTab("profile");
      translateX.setValue(-drawerWidth);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(translateX, { toValue: -drawerWidth, duration: 220, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setMounted(false));
  }, [visible, drawerWidth, mounted, translateX, backdrop]);

  // Carga el perfil público al abrir / cambiar de usuario.
  useEffect(() => {
    if (!visible || !userId || !token) return;
    if (loadedIdRef.current === userId && profile) return;
    loadedIdRef.current = userId;
    setProfile(null);
    setLoading(true);
    let alive = true;
    getPublicProfile(userId, token)
      .then((p) => { if (alive) setProfile(p); })
      .catch(() => { if (alive) setProfile(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible, userId, token]);

  if (!mounted) return null;

  const displayName = profile?.name || userName || "—";
  const initial = (displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <RNModal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.drawer,
            { width: drawerWidth, transform: [{ translateX }], backgroundColor: tokens.bgPrimary, borderRightColor: tokens.border },
          ]}
        >
          <View style={[styles.tabsWrap, { borderBottomColor: tokens.border }]}>
            <SegmentedControl
              items={[
                { key: "profile", label: s.profile },
                { key: "worklog", label: s.worklog },
              ]}
              value={tab}
              onChange={(k) => setTab(k as Tab)}
            />
          </View>

          <View style={styles.body}>
            {tab === "profile" ? (
              <View style={styles.profile}>
                <View style={[styles.avatar, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                  {profile?.photoUrl ? (
                    <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.avatarInitial, { color: tokens.brand }]}>{initial}</Text>
                  )}
                </View>
                <Text style={[styles.sharedBy, { color: tokens.textMuted, textAlign }]}>{s.sharedBy}</Text>
                <Text style={[styles.name, { color: tokens.textPrimary, textAlign }]} numberOfLines={2}>{displayName}</Text>
                {loading && !profile ? (
                  <ActivityIndicator color={tokens.brand} style={{ marginTop: 10 }} />
                ) : profile?.company ? (
                  <View style={[styles.companyRow, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
                    <Building2 size={14} color={tokens.textMuted} />
                    <Text style={[styles.company, { color: tokens.textSecondary }]} numberOfLines={1}>{profile.company}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <WorklogTab visible={visible && tab === "worklog"} token={token} language={language ?? "es"} userId={userId ?? undefined} />
            )}
          </View>
        </Animated.View>
        <Animated.View style={[styles.backdrop, { opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="close" />
        </Animated.View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  drawer: { height: "100%", borderRightWidth: 1, zIndex: 2, elevation: 8 },
  backdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "#000", zIndex: 1 },
  tabsWrap: { paddingHorizontal: 10, paddingTop: 14, paddingBottom: 8, borderBottomWidth: 1 },
  body: { flex: 1 },
  profile: { padding: 18, alignItems: "center", gap: 6 },
  avatar: { width: 84, height: 84, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 8 },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 34, fontWeight: "900" },
  sharedBy: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  name: { fontSize: 20, fontWeight: "800" },
  companyRow: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginTop: 8 },
  company: { fontSize: 13, fontWeight: "600" },
});
