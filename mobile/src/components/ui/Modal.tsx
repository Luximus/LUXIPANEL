import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ScopedNativeModal as RNModal } from "../../screens/main/native-module-context";;
import { cancelActiveInlineEdit } from "../../lib/inline-edit-back";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { getLocaleDirection, getLocaleRowDirection, getLocaleTextAlign, getMessages, isRtlLocale } from "../../i18n";
import { styles } from "./Modal.styles";

type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  language?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Por defecto el cuerpo envuelve a `children` en un `ScrollView`. Ponlo en
   * `false` cuando el contenido gestiona su propio scroll (p. ej. un `FlatList`
   * o `ScrollView` por pestaña) para evitar VirtualizedLists anidadas. En ese
   * caso el cuerpo es una `View` con `flex: 1` y el hijo debe rellenarla.
   */
  scrollable?: boolean;
  /** Fija la altura de la tarjeta al 90% (modal "sheet" de pantalla casi
   *  completa); útil con `scrollable={false}` para acotar el scroll interno. */
  fillHeight?: boolean;
};

export function Modal({ visible, onClose, title, language, children, footer, scrollable = true, fillHeight = false }: ModalProps) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const t = getMessages(language);
  const rtl = isRtlLocale(language);
  const direction = getLocaleDirection(language);
  const rowDirection = getLocaleRowDirection(language);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      // Android: atrás CANCELA — si hay una edición inline en curso dentro del
      // modal la descarta primero; si no, cierra el modal (mismo efecto que la
      // X / botón Cancelar). El tap fuera sigue sin cerrar (evita perder lo
      // escrito por accidente).
      onRequestClose={() => {
        if (cancelActiveInlineEdit()) return;
        onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        {/* El overlay NO cierra al tocar fuera: usamos una View, no un
            Pressable con onClose, para evitar perder lo escrito por accidente. */}
        <View
          style={[styles.overlay, { backgroundColor: tokens.bgOverlay }]}
        >
          <View
            style={[
              styles.card,
              fillHeight ? styles.cardFill : null,
              { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, direction },
            ]}
          >
            {title ? (
              <View style={[styles.header, { borderBottomColor: tokens.border, flexDirection: rowDirection }]}>
                <Text style={[styles.title, { color: tokens.textPrimary, textAlign: getLocaleTextAlign(language) }, rtl ? styles.titleRtl : null]}>
                  {title}
                </Text>
                <Pressable
                  onPress={onClose}
                  accessibilityLabel={t.common.close}
                  style={styles.closeBtn}
                >
                  <Text style={[styles.closeIcon, { color: tokens.textMuted }]}>X</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.headerNoTitle, { flexDirection: rowDirection }]}>
                <Pressable
                  onPress={onClose}
                  accessibilityLabel={t.common.close}
                  style={styles.closeBtn}
                >
                  <Text style={[styles.closeIcon, { color: tokens.textMuted }]}>X</Text>
                </Pressable>
              </View>
            )}
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

