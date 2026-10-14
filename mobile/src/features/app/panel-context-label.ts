/**
 * Deriva la etiqueta de CONTEXTO (sin el subdominio) a partir de la URL que el
 * WebView de LUXIPANEL tiene cargada. Las rutas del panel son `/panel/<modulo>/…`
 * (p. ej. `/panel/terminal`, `/panel/files`, `/panel/assistant`), así que el
 * módulo activo es el segmento que sigue a `panel`.
 *
 * Devuelve `null` para la home del panel (`/panel`) o cuando no hay módulo: en
 * ese caso la pestaña se rotula solo con el subdominio.
 *
 * NOTA (inferencia por URL): el número de terminal NO viaja en la URL — la página
 * `/panel/terminal` gestiona varias pestañas de terminal internamente — así que
 * el terminal se rotula "Terminal" sin índice. Ídem: el nombre del módulo es el
 * slug humanizado, no su nombre traducido dentro del panel.
 */
export function panelContextLabelFromUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  let pathname = "";
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  const segments = pathname.split("/").filter(Boolean); // ["panel","terminal",…]
  const panelIdx = segments.indexOf("panel");
  const slug = panelIdx >= 0 ? segments[panelIdx + 1] : undefined;
  if (!slug) return null; // home del panel (`/panel`) → sin contexto
  return humanizeSlug(slug);
}

/** `module-dev` → "Module dev", `terminal` → "Terminal". */
function humanizeSlug(slug: string): string {
  const s = slug.replace(/[-_]+/g, " ").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
