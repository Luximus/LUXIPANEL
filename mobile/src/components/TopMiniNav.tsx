import React from "react";
import { Animated } from "react-native";
import { LifeBuoy, Newspaper } from "lucide-react-native";
import { getMessages } from "../i18n";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import { SegmentedControl, type SegmentItem } from "./ui/SegmentedControl";

type ViewId = "dashboard" | "support" | "security" | "payments" | "blogfeed";

export function TopMiniNav({
  language,
  activeView,
  onGoServers,
  onGoSupport,
  onGoPayments,
  onGoBlog,
  isAdmin = false,
  tokens,
}: {
  language: string;
  activeView: ViewId;
  onGoServers: () => void;
  onGoSupport: () => void;
  // Seguridad ya no aparece en el TopMiniNav (se accede desde el menú de cuenta).
  // Se mantiene la prop opcional para no romper a los llamadores que aún la pasan.
  onGoSecurity?: () => void;
  onGoPayments?: () => void;
  // Blog (feed social). Solo aparece como pestaña cuando el llamador lo pasa
  // (la pantalla de Blog y los puntos de entrada que lo habilitan).
  onGoBlog?: () => void;
  /**
   * El flujo de SOPORTE del CLIENTE se movió al asistente (FAB/modal): el tab
   * "Soporte" del TopMiniNav queda SOLO para staff/admin (consola de tickets).
   * Los clientes usan el asistente; por eso por defecto NO se muestra.
   */
  isAdmin?: boolean;
  tokens: {
    bgCard: string;
    bgCardSolid: string;
    border: string;
    brand: string;
    textSecondary: string;
  };
}) {
  const t = getMessages(language);
  const appearAnim = useEnterAnimation({ duration: 380, delay: 40, fromY: -8 });

  const items: SegmentItem[] = [
    ...(isAdmin ? [{ key: "support", label: t.titleBar.fabSupport, icon: <LifeBuoy size={13} /> }] : []),
    ...(onGoBlog ? [{ key: "blogfeed", label: t.blogfeed.screenTitle, icon: <Newspaper size={13} /> }] : []),
  ];

  const onChange = (key: string) => {
    if (key === "support") onGoSupport();
    else if (key === "blogfeed") onGoBlog?.();
  };

  if (items.length === 0) return null;

  return (
    <Animated.View style={appearAnim.style}>
      <SegmentedControl items={items} value={activeView} onChange={onChange} scroll />
    </Animated.View>
  );
}
