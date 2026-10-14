// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Declaraciones para módulos que `tsc` no puede resolver por sí mismo.
 *
 * ── `*.astro` ────────────────────────────────────────────────────────────────
 * `tsc` no sabe parsear ficheros Astro; de eso se encarga `astro check`, que en
 * este servidor no sirve como puerta (revienta por OOM). Sin declararlos, todo
 * `.ts` que importe un componente Astro emitía un TS2307 — ruido que enterraba
 * los defectos REALES del frontend.
 *
 * Se usa la forma ABREVIADA (`declare module "x";`, sin cuerpo) a propósito. Un
 * cuerpo con `export default` solo habría cubierto la mitad: los `.astro`
 * exportan también valores CON NOMBRE desde su frontmatter — p.ej.
 * `import Alert, { alert } from "./Alert.astro"`, donde `alert` es una variante
 * `tv()`. La forma abreviada admite ambos.
 *
 * COSTE, dicho claramente: todo lo importado de un `.astro` queda como `any`.
 * No es una regresión — `tsc` NUNCA pudo tiparlo, con shim o sin él; lo que
 * cambia es que ya no tapa lo que sí podemos ver. Las props de los componentes
 * Astro solo las verifica el toolchain de Astro.
 *
 * ── xterm por CDN ───────────────────────────────────────────────────────────
 * `CliTerminalView` carga xterm como ESM desde jsDelivr en tiempo de ejecución
 * (no está en package.json, no se empaqueta). Misma situación: sin declararlo,
 * TS2307; declarado, el import es `any` y el resto del fichero sí se comprueba.
 */

declare module "*.astro";

declare module "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/+esm";
declare module "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/+esm";
