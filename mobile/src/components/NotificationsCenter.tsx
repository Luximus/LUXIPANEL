import React from "react";
import { StyleSheet, View } from "react-native";
import NotificationLogPanel from "./NotificationLogPanel";

/**
 * Centro de notificaciones (drawer central de la campana). Solo muestra el
 * LISTADO/registro de notificaciones enviadas (todos los servidores). La
 * configuración de alertas por servidor se migró a un módulo de LUXIPANEL y ya
 * no se gestiona desde la app. El cuerpo del modal NO scrollea
 * (scrollable={false}): el FlatList del registro gestiona su propio scroll. El
 * contenido lleva padding propio (el `bodyFill` del modal no lo aporta) para no
 * quedar pegado a los bordes.
 */
export default function NotificationsCenter({
  token,
  language,
  onOpenServer,
}: {
  token: string;
  language?: string;
  /** Click en una notificación de un servidor → enfoca su tarjeta en el carousel. */
  onOpenServer?: (panelId: string) => void;
}) {
  return (
    <View style={styles.root}>
      <NotificationLogPanel token={token} language={language} onOpenServer={onOpenServer} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Padding propio: el cuerpo del modal (bodyFill, scrollable=false) no aporta
  // ninguno, así que aquí evitamos que el contenido quede pegado a los lados y
  // arriba; el bottom lo da el content-container del FlatList.
  root: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
});
