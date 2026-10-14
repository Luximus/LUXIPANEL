// Constantes puras del controlador de pestaña principal (`useMainTabController`).
// Extraídas para reducir el tamaño del hook sin tocar comportamiento.

/** Ventana (ms) durante la cual reusamos el último resultado de ping de un
 *  servidor sin rehacer el handshake SSH. Evita re-sondear en cada carga /
 *  refresh y el parpadeo de "Comprobando" al reentrar a la pantalla. */
export const STATUS_TTL_MS = 45_000;

/** Cada cuánto (ms) volcamos en lote los resultados de ping acumulados. */
export const STATUS_FLUSH_MS = 400;
