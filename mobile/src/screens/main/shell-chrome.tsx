// Helpers de cromo del shell (Wave D1: extraídos de MainScreen.tsx sin cambios
// de semántica): backdrop animable, transición de ruta y el traductor de
// acciones del asistente de soporte.
import React, { useEffect } from "react";
import { Animated, Easing, Pressable } from "react-native";
import type { useMainTabController } from "../../hooks/useMainTabController";
import type { ChatAction } from "../../components/SupportChatWidget";
import type { BlogDrawerTarget } from "./shell-types";

/**
 * Traduce las acciones `navigate` / `open_modal` del asistente de soporte a la
 * navegación interna del cliente. `confirm_mutation` lo resuelve el propio
 * widget contra el backend. Pagos/Seguridad abren el modal de cuenta en su
 * pestaña (goToPaymentsView / goToSecurityView lo hacen internamente).
 */
export function handleAssistantAction(
  ctrl: ReturnType<typeof useMainTabController>,
  action: ChatAction,
  openBlogDrawer: (tab?: BlogDrawerTarget) => void,
  openSupportDrawer: () => void,
): void {
  if (action.type === "navigate") {
    const href = action.href.toLowerCase();
    if (href.includes("/support")) openSupportDrawer();
    else if (href.includes("/payment")) ctrl.goToPaymentsView();
    else if (href.includes("/security")) ctrl.goToSecurityView();
    else if (href.includes("/blog")) openBlogDrawer("blog");
    else if (href.includes("/server")) ctrl.goToServersView();
    return;
  }
  if (action.type === "open_modal") {
    if (action.modal === "new_ticket") ctrl.openNewTicketModal();
    else ctrl.goToServersView();
  }
}

/** Backdrop (scrim) animable: su opacidad la conduce el valor `*Backdrop` para
 *  que el oscurecido haga FADE en vez de aparecer/desaparecer de golpe (antes se
 *  veía "machetiado" porque era un Pressable con color estático). */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function RouteTransition({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateX = React.useRef(new Animated.Value(22)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(22);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, routeKey, translateX]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}
