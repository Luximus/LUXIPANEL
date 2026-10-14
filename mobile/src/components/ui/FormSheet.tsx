import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ScopedNativeModal as RNModal } from "../../screens/main/native-module-context";;
import { GestureHandlerRootView, PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelActiveInlineEdit } from "../../lib/inline-edit-back";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages, isRtlLocale } from "../../i18n";
import { styles } from "./FormSheet.styles";

type FormSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  language?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Por defecto el cuerpo envuelve a `children` en un `ScrollView`. Ponlo en
   * `false` cuando el contenido gestiona su propio scroll (FlatList / ScrollView
   * por pestaña) para evitar VirtualizedLists anidadas.
   */
  scrollable?: boolean;
  /** Fija la altura del sheet al 80% (en vez de crecer con el contenido). */
  fillHeight?: boolean;
};

/**
 * Drawer CENTRAL de formularios: bottom-sheet que sube desde el borde inferior
 * hasta el 80% de la pantalla, por ENCIMA de cualquier drawer lateral (va en su
 * propio RN Modal). Se conserva para selectores y flujos de cuenta/conexión.
 * Los formularios de alta y edición de módulos usan `ui/FormDrawer`, lateral
 * y de altura completa; `ui/Modal` aloja visores y resultados centrados.
 *
 * Misma API que `ui/Modal` para que la migración de un formulario sea 1:1.
 * Cierre: X, swipe-abajo sobre el asa/cabecera o atrás de Android (cancela la
 * edición en curso); tap en el backdrop NO (evita perder lo escrito, como en
 * `ui/Modal`).
 */
export function FormSheet({ visible, onClose, title, language, children, footer, scrollable = true, fillHeight = false }: FormSheetProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const t = getMessages(language);
  const rtl = isRtlLocale(language);
  const direction = getLocaleDirection(language);
  const rowDirection = getLocaleRowDirection(language);
  const { height: screenHeight } = useWindowDimensions();
  // El sheet pega con el borde inferior de la pantalla (edge-to-edge): reserva la
  // barra de navegación Android/home indicator para que no tape botones/inputs.
  const insets = useSafeAreaInsets();

  // Montaje controlado para poder animar la salida antes de desmontar el Modal.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El alto de ventana cambia al abrir/cerrar el teclado (adjustResize): se lee
  // por ref para que ese cambio NO re-dispare la animación de apertura (el sheet
  // "rebotaba" y podía quedar descolocado al ocultar el teclado).
  const screenHeightRef = useRef(screenHeight);
  screenHeightRef.current = screenHeight;

  // Android: teclado gestionado A MANO con los eventos de Keyboard. El KAV
  // dentro de un RN Modal es poco fiable ahí ("height" restauraba una altura
  // equivocada y "padding" dejaba padding residual al ocultar): con eventos, al
  // ocultarse el teclado el padding vuelve SIEMPRE a 0 exacto y el sheet queda
  // pegado al fondo. Se resta insets.bottom porque el alto reportado del
  // teclado incluye la zona de la barra de navegación (edge-to-edge) y el
  // sheet ya reserva ese espacio con su propio paddingBottom.
  const [androidKbPad, setAndroidKbPad] = useState(0);
  useEffect(() => {
    if (Platform.OS === "ios") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setAndroidKbPad(Math.max(0, e.endCoordinates.height - insets.bottom));
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setAndroidKbPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (visible) {
      setMounted(true);
      translateY.setValue(screenHeightRef.current);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(translateY, { toValue: screenHeightRef.current, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      closeTimer.current = setTimeout(() => {
        setMounted(false);
        closeTimer.current = null;
      }, 30);
    });
  }, [visible, mounted, translateY, backdrop]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Swipe-abajo sobre el asa/cabecera cierra el sheet (el cuerpo conserva su
  // scroll vertical: el gesto solo vive en la zona de agarre).
  const handleGrabSwipe = React.useCallback((event: PanGestureHandlerStateChangeEvent) => {
    const { oldState, translationY, velocityY } = event.nativeEvent;
    if (oldState !== State.ACTIVE) return;
    if (translationY > 32 || velocityY > 650) onClose();
  }, [onClose]);

  if (!mounted) return null;

  return (
    <RNModal
      visible
      transparent
      animationType="none"
      // Android: atrás CANCELA — si hay una edición inline en curso dentro del
      // sheet la descarta primero; si no, cierra el sheet (mismo efecto que la
      // X). Con el teclado abierto, atrás lo oculta primero a nivel nativo y
      // solo el siguiente atrás llega aquí.
      onRequestClose={() => {
        if (cancelActiveInlineEdit()) return;
        onClose();
      }}
    >
      {/* GestureHandlerRootView propio: dentro de un RN Modal los gestos no
          heredan el root de la app (Android). */}
      <GestureHandlerRootView style={styles.keyboardAvoider}>
        {/* iOS: KAV padding (fiable ahí). Android: androidKbPad manual en el
            overlay — ver el efecto de Keyboard arriba. */}
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          enabled={Platform.OS === "ios"}
          keyboardVerticalOffset={24}
        >
          <View style={[styles.overlay, { direction, paddingBottom: androidKbPad }]}>
            <Animated.View style={[styles.backdrop, { backgroundColor: tokens.bgOverlay, opacity: backdrop }]} />
            {/* El backdrop NO cierra al tocar fuera (evita perder lo escrito). */}
            <Animated.View
              style={[
                styles.sheet,
                fillHeight ? styles.sheetFill : null,
                { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, paddingBottom: insets.bottom, transform: [{ translateY }] },
                // Con el teclado abierto el 80% ya no cabe: capa la altura al
                // hueco libre real para que el sheet no se salga por arriba.
                androidKbPad > 0
                  ? { maxHeight: Math.max(240, Math.min(screenHeight * 0.8, screenHeight - androidKbPad - insets.top - 12)) }
                  : null,
              ]}
            >
              <PanGestureHandler onHandlerStateChange={handleGrabSwipe} activeOffsetY={[-12, 12]} failOffsetX={[-24, 24]}>
                <View style={styles.grabZone}>
                  <View style={styles.handleRow}>
                    <View style={[styles.handleBar, { backgroundColor: tokens.border }]} />
                  </View>
                  {title ? (
                    <View style={[styles.header, { borderBottomColor: tokens.border, flexDirection: rowDirection }]}>
                      <Text style={[styles.title, { color: tokens.textPrimary, textAlign: getLocaleTextAlign(language) }, rtl ? styles.titleRtl : null]}>
                        {title}
                      </Text>
                      <Pressable onPress={onClose} accessibilityLabel={t.common.close} style={styles.closeBtn}>
                        <Text style={[styles.closeIcon, { color: tokens.textMuted }]}>X</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={[styles.headerNoTitle, { flexDirection: rowDirection }]}>
                      <Pressable onPress={onClose} accessibilityLabel={t.common.close} style={styles.closeBtn}>
                        <Text style={[styles.closeIcon, { color: tokens.textMuted }]}>X</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </PanGestureHandler>
              {scrollable ? (
                <ScrollView
                  style={styles.body}
                  contentContainerStyle={styles.bodyContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={styles.bodyFill}>{children}</View>
              )}
              {footer ? (
                <View style={[styles.footer, { borderTopColor: tokens.border, backgroundColor: tokens.bgCardSolid, flexDirection: rowDirection }]}>
                  {footer}
                </View>
              ) : null}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </RNModal>
  );
}
