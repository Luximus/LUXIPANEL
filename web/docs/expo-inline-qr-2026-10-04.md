<!-- documentation-status-20261013 -->
> **Documento histórico o de planificación.** Conserva propuestas, resultados y límites de su fecha; no acredita el estado ni la publicación actuales. Consultar la [referencia vigente](../README.md) y el código antes de ejecutar sus instrucciones. Clasificado el 13 de octubre de 2026.

# Expo: QR vigente en la tabla

Las filas con una sesión Metro activa muestran su QR directamente, junto a Detener. El botón QR permanece cuando no hay sesión. La apertura no inicia túneles; GET /api/expo/dev-client/status consulta exclusivamente la unidad y el log del servidor seleccionado, protegido por autenticación y permiso Expo. No necesita token EAS. Una unidad detenida nunca expone su URL anterior.

El estado se actualiza al cargar proyectos y cada 15 segundos mientras el módulo está visible. El QR usa canvas de144px con margen blanco de4 módulos. Detener tiene objetivo táctil mínimo44px y guarda el QR si falla. La operación queda bloqueada contra doble clic. Generación de destino, identidad de raíz y revisión por proyecto descartan respuestas tardías, incluso un polling que termina después de detener. Lecturas canceladas durante hidratación inicial se recuperan con reintento limitado dentro del mismo contexto; no se reintentan mutaciones.
