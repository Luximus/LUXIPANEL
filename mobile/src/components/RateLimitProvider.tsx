import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScopedNativeModal as RNModal } from "../screens/main/native-module-context";;
import { Clock } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { loadSessionState } from "../lib/session-state";
import { formatMessage, getLocaleTextAlign, getMessages, isRtlLocale } from "../i18n";
import { onRateLimited } from "../lib/rate-limit-notice";
import { styles } from "./RateLimitProvider.styles";

/**
 * Contexto del límite de peticiones. Expone un `reloadToken` que se incrementa
 * cuando el usuario pulsa "Recargar" tras la cuenta atrás del 429: las pantallas
 * (vía `useMainTabController`) lo observan para re-disparar la carga de sus datos
 * sin un reload total de la app (RN no tiene `window.location.reload`). Espejo
 * del comportamiento del desktop, donde el botón recarga la SPA.
 */
type RateLimitContextValue = { reloadToken: number };

const RateLimitContext = createContext<RateLimitContextValue>({ reloadToken: 0 });

/** Token de recarga: cambia cuando el usuario confirma "Recargar" tras un 429. */
export function useRateLimitReload(): number {
  return useContext(RateLimitContext).reloadToken;
}

/** Formatea segundos como m:ss (p. ej. 905 → "15:05"). Neutral por locale. */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Proveedor + modal global del límite de peticiones (HTTP 429). Escucha el bus
 * `rate-limit-notice`; al recibir un aviso muestra el motivo y una cuenta atrás
 * (según `retryAfter` del backend) hasta poder reintentar. Se monta una sola vez
 * en `App`. NO se puede cerrar durante la cuenta atrás (sin X, sin tocar fuera,
 * el botón atrás de Android no lo cierra); al terminar aparece el botón
 * "Recargar" que incrementa `reloadToken` para refrescar los datos de la
 * pantalla actual. Espejo del `RateLimitModal` del desktop.
 */
export function RateLimitProvider({ children, language }: { children: React.ReactNode; language?: string }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const lang = language ?? loadSessionState().language;
  const t = getMessages(lang).rateLimit;
  const rtl = isRtlLocale(lang);
  const textAlign = getLocaleTextAlign(lang);

  // Epoch (ms) en que se podrá reintentar; null = modal cerrado.
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  // Suscripción a los avisos globales de 429. Si llega otro mientras está
  // abierto, conserva el reintento MÁS lejano (espera más conservadora).
  useEffect(() => {
    return onRateLimited((notice) => {
      setRetryAt((prev) => (prev !== null && prev > notice.retryAt ? prev : notice.retryAt));
    });
  }, []);

  // Cuenta atrás de 1s mientras el modal está abierto.
  useEffect(() => {
    if (retryAt === null) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [retryAt]);

  // El botón solo aparece al terminar la cuenta atrás. Cierra el modal e
  // incrementa el token de recarga: las pantallas refrescan sus datos (re-disparan
  // las peticiones iniciales ya sin el límite activo). No toca auth ni navegación.
  const reload = useCallback(() => {
    setRetryAt(null);
    setReloadToken((n) => n + 1);
  }, []);

  const ctx = useMemo<RateLimitContextValue>(() => ({ reloadToken }), [reloadToken]);
  const ready = remaining <= 0;

  return (
    <RateLimitContext.Provider value={ctx}>
      {children}
      <RNModal
        visible={retryAt !== null}
        transparent
        animationType="fade"
        // Android: onRequestClose (botón atrás) NO debe cerrar el modal durante la
        // cuenta atrás. Lo dejamos como no-op SIEMPRE: el único cierre es el botón
        // "Recargar", que solo existe cuando la cuenta atrás terminó.
        onRequestClose={() => {}}
      >
        {/* El overlay es una View (no Pressable con onClose): tocar fuera NO cierra. */}
        <View style={[styles.overlay, { backgroundColor: tokens.bgOverlay }]}>
          <View style={[styles.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
            <Text style={[styles.title, { color: tokens.textPrimary, textAlign }]}>{t.title}</Text>
            <Text style={[styles.description, { color: tokens.textMuted, textAlign }]}>{t.description}</Text>

            <View style={[styles.countdownRow, rtl ? styles.countdownRowRtl : null]}>
              <Clock size={15} color={ready ? tokens.success : tokens.textPrimary} />
              <Text style={[styles.countdownText, { color: ready ? tokens.success : tokens.textPrimary }]}>
                {ready ? t.ready : formatMessage(t.retryIn, { time: formatCountdown(remaining) })}
              </Text>
            </View>

            {ready ? (
              <Pressable
                onPress={reload}
                accessibilityRole="button"
                accessibilityLabel={t.reload}
                style={[styles.reloadBtn, { backgroundColor: tokens.brand }]}
              >
                <Text style={styles.reloadLabel}>{t.reload}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </RNModal>
    </RateLimitContext.Provider>
  );
}
