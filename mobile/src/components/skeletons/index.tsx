import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Skeleton, SkeletonCircle, SkeletonText, SkeletonCard } from "../ui/Skeleton";

/**
 * Skeletons compuestos por superficie. Cada uno IMITA el layout real del
 * componente que reemplaza mientras carga, para que la transición a contenido
 * real no "salte". Construidos sobre las primitivas de `ui/Skeleton`.
 */

// ── Carousel / window card (portada del asistente del servidor) ──────────────
/** Imita la PORTADA real del carousel (`ServerAssistantPane`): logo centrado +
 *  nombre con estrella + IP/iconos de acción, fila de 4 stats (CPU/RAM/Disco/Datos),
 *  separador y la columna de botones. Centrada verticalmente como la portada, para
 *  que al llegar el color el contenido aparezca en el mismo sitio (sin salto). */
export function ServerWindowSkeleton() {
  return (
    <View style={styles.heroRoot}>
      {/* Hero: logo + nombre (estrella) + IP con iconos de acción */}
      <View style={styles.heroBlock}>
        <Skeleton width={112} height={112} radius={26} />
        <View style={styles.heroTitleRow}>
          <SkeletonCircle size={22} />
          <Skeleton width={150} height={20} radius={6} />
        </View>
        <View style={styles.heroIpRow}>
          <Skeleton width={128} height={14} radius={6} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={28} height={28} radius={8} />
          ))}
        </View>
      </View>

      {/* Fila de 4 stats (CPU/RAM/Disco/Datos) */}
      <View style={styles.heroStatsRow}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={56} radius={12} style={styles.flex1} />
        ))}
      </View>

      <Skeleton height={1} radius={0} style={styles.heroSeparator} />

      {/* Columna de botones (Más herramientas / Empezar conversación / Nueva
          terminal · separador · Registrar servidor / Registrar llave). */}
      <View style={styles.heroBtns}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={50} radius={14} />
        ))}
        <Skeleton height={1} radius={0} style={styles.heroSeparator} />
        {[0, 1].map((i) => (
          <Skeleton key={`b${i}`} height={50} radius={14} />
        ))}
      </View>
    </View>
  );
}

// ── Tab "Server" del drawer izquierdo ────────────────────────────────────────
/** Réplica del cuerpo editable del tab Server (mini-stats + tarjetas + logins).
 *  Se muestra mientras el panel visible y su editor inline terminan de sembrarse
 *  (antes se veía un parpadeo de la versión de solo lectura). */
export function ServerTabSkeleton() {
  return (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.drawerBody} showsVerticalScrollIndicator={false}>
      {/* Mini-stats en vivo */}
      <View style={styles.miniRow}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={34} radius={10} style={styles.flex1} />
        ))}
      </View>
      {/* "Utilizar más herramientas" */}
      <Skeleton height={44} radius={10} />
      {/* Pares de tarjetas (Estado+Proveedor / Nombre+IP) */}
      {[0, 1].map((i) => (
        <View key={i} style={styles.pairRow}>
          <SkeletonCard style={styles.flex1}>
            <Skeleton width="50%" height={10} />
            <Skeleton width="80%" height={16} />
          </SkeletonCard>
          <SkeletonCard style={styles.flex1}>
            <Skeleton width="50%" height={10} />
            <Skeleton width="80%" height={16} />
          </SkeletonCard>
        </View>
      ))}
      {/* Categoría + SSH (tarjetas completas) */}
      {[0, 1].map((i) => (
        <SkeletonCard key={i}>
          <Skeleton width="40%" height={10} />
          <Skeleton height={38} radius={8} />
        </SkeletonCard>
      ))}
      {/* Filas de login (switch) */}
      {[0, 1].map((i) => (
        <Skeleton key={i} height={44} radius={10} />
      ))}
      {/* Fila de acciones (eliminar + probar) */}
      <View style={styles.pairRow}>
        <Skeleton width={42} height={42} radius={10} />
        <Skeleton height={42} radius={10} style={styles.flex1} />
      </View>
    </ScrollView>
  );
}

// ── Tab "Chat" del drawer izquierdo ──────────────────────────────────────────
/** Selector de proveedores (botones) + lista de conversaciones. */
export function ChatTabSkeleton() {
  return (
    <View style={styles.chatRoot}>
      {/* Cabecera del selector + engranaje */}
      <View style={styles.chatHead}>
        <Skeleton width="55%" height={14} />
        <Skeleton width={34} height={34} radius={10} />
      </View>
      {/* Botones de proveedor */}
      <View style={styles.provRow}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={120} height={44} radius={12} />
        ))}
      </View>
      {/* Buscador + nuevo */}
      <View style={styles.chatSearchRow}>
        <Skeleton height={38} radius={10} style={styles.flex1} />
        <Skeleton width={38} height={38} radius={10} />
      </View>
      {/* Lista de conversaciones */}
      <View style={styles.listGroup}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={36} radius={8} />
        ))}
      </View>
    </View>
  );
}

// ── Listas genéricas (SSH/Categorías del drawer izq, tabs del drawer der) ─────
/** Filas de lista con icono + texto. Sirve para SSH/Categorías y para los tabs
 *  del drawer derecho (Tienda/Perfil/Blog) mientras cargan sus datos. */
export function ListPanelSkeleton({ rows = 6, withHeader = false, gap }: { rows?: number; withHeader?: boolean; gap?: number }) {
  return (
    <View style={[styles.listPanel, gap != null ? { gap } : null]}>
      {withHeader ? <Skeleton width="45%" height={18} style={styles.listHeader} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonCard key={i} style={styles.listRow}>
          <SkeletonCircle size={32} />
          <View style={styles.flex1}>
            <Skeleton width="60%" height={13} />
            <Skeleton width="35%" height={10} />
          </View>
          <Skeleton width={54} height={24} radius={8} />
        </SkeletonCard>
      ))}
    </View>
  );
}

/** Cuadrícula de tarjetas (paquetes de datos / productos de la Tienda). */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.gridPanel}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} style={styles.gridCard}>
          <Skeleton width="55%" height={16} />
          <Skeleton width="35%" height={26} />
          <SkeletonText lines={2} />
          <Skeleton height={38} radius={10} />
        </SkeletonCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  // window / carousel — imita la portada centrada de ServerAssistantPane.
  heroRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 22 },
  heroBlock: { alignSelf: "stretch", alignItems: "center", gap: 14 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  heroIpRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  heroStatsRow: { flexDirection: "row", alignSelf: "stretch", gap: 8 },
  heroSeparator: { alignSelf: "stretch", opacity: 0.5 },
  heroBtns: { alignSelf: "stretch", gap: 10 },
  // drawer server tab
  drawerBody: { padding: 12, gap: 9 },
  miniRow: { flexDirection: "row", gap: 6 },
  pairRow: { flexDirection: "row", gap: 9 },
  // chat tab
  chatRoot: { flex: 1, padding: 12, gap: 12 },
  chatHead: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "space-between" },
  provRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chatSearchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  listGroup: { gap: 8, marginTop: 2 },
  // generic list
  listPanel: { padding: 12, gap: 9 },
  listHeader: { marginBottom: 4 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  // grid
  gridPanel: { padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCard: { width: "47%", minWidth: 150, flexGrow: 1 },
});
