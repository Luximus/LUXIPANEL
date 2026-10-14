import React from "react";
import { DevSettings, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatDevelopmentError } from "./development-errors";


function clientIdentity() {
  try {
    const app = require("expo-application");
    const constants = require("expo-constants").default;
    return `Cliente ${app.nativeApplicationVersion ?? "desconocido"} · build ${app.nativeBuildVersion ?? "desconocido"} · ${constants.executionEnvironment}`;
  } catch { return "No se pudo consultar la versión del cliente"; }
}

function StartupFailure({ error }: { error: unknown }) {
  const developmentApk = process.env.EXPO_PUBLIC_DEVELOPMENT_APK_URL?.trim();
  const diagnostic = formatDevelopmentError(error);
  const requiresNativeUpdate = /RNSkia|Skia Module|native module|TurboModuleRegistry|Worklets.*(?:version|native)|Reanimated.*(?:version|native)/i.test(diagnostic);
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.card}>
      <Text style={styles.title}>No se pudo iniciar LUXIPANEL</Text>
      <Text selectable style={styles.identity}>{clientIdentity()}</Text>
      <Text style={styles.description}>{requiresNativeUpdate
        ? "El error menciona una dependencia nativa. Instala el cliente de desarrollo compatible con este proyecto y vuelve a abrir el mismo QR."
        : "Esta pantalla conserva el error de arranque para revisarlo en la sesión Expo."}</Text>
      <Text selectable style={styles.diagnostic}>{diagnostic}</Text>
      {requiresNativeUpdate && developmentApk && /^https:\/\//i.test(developmentApk) && <Pressable accessibilityRole="link" style={styles.action} onPress={() => { void Linking.openURL(developmentApk).catch(() => {}); }}><Text style={styles.actionLabel}>Descargar cliente de desarrollo</Text></Pressable>}
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => DevSettings.reload()}><Text style={styles.actionLabel}>Reintentar</Text></Pressable>
    </View>
  </ScrollView>;
}

class StartupBoundary extends React.Component<{ children: React.ReactNode }, { error: unknown | null }> {
  state = { error: null as unknown | null };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: Error) { console.error("[LUXIPANEL render startup]", error); }
  render() { return this.state.error === null ? this.props.children : <StartupFailure error={this.state.error} />; }
}

function failedDevelopmentRoot(startupError: unknown) {
  return function FailedDevelopmentRoot() { return <StartupFailure error={startupError} />; };
}

/** Catch failed imports before root registration, so Metro can flush queued logs. */
export function createDevelopmentRoot(load: () => React.ComponentType) {
  if (!__DEV__) throw new Error("Development startup must not run in production");
  try {
    const App = load();
    return function DevelopmentRoot() { return <StartupBoundary><App /></StartupBoundary>; };
  } catch (error) {
    console.error("[LUXIPANEL import startup]", error);
    return failedDevelopmentRoot(error);
  }
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingTop: 60, justifyContent: "center", backgroundColor: "#0b1220" },
  card: { gap: 16 }, title: { fontSize: 24, fontWeight: "700", color: "#f8fafc" },
  identity: { color: "#93c5fd", fontSize: 13 }, description: { color: "#cbd5e1", lineHeight: 22 },
  diagnostic: { color: "#fca5a5", fontSize: 12, lineHeight: 18 },
  action: { minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: "#1e293b", padding: 12 },
  actionLabel: { color: "#f8fafc", fontWeight: "600" },
});
