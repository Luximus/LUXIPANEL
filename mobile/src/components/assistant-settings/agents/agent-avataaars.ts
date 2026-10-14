// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Avataaars para agentes — puerto RN de WEB/floating-assistant/agent-avataaars.ts.
 *
 * Igual que el web, el SVG se genera 100% EN PROCESO con `@dicebear/core` +
 * `@dicebear/avataaars` (nunca por HTTP / CDN): `buildAvatarSvg()` devuelve el
 * SVG como string para pintarlo con `<SvgXml />` (react-native-svg). Todo lo
 * demás (enums del schema, opciones, seed aleatorio, construcción del objeto de
 * opciones) es PURO y lo comparten el mini-editor de avatar (W3) y AgentAvatar (W6).
 *
 * Los valores de enum se extrajeron del schema real de `@dicebear/avataaars`
 * 9.4.2 (mismo que usa el web); mantenerlos en sincronía si se sube la versión.
 */
import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";
import type { AvatarConfig } from "../types";

/** Versión de DiceBear usada (debe casar con el `@dicebear/*` del web). */
export const DICEBEAR_VERSION = "9.4.2";

/** Atributos de forma (enums del schema) editables en el mini-editor. */
export const AVATAR_ENUM_ATTRS = [
  "top",
  "eyes",
  "eyebrows",
  "mouth",
  "clothing",
  "accessories",
  "facialHair",
] as const;

/** Atributos de color — valores de la paleta por defecto del schema. */
export const AVATAR_COLOR_ATTRS = ["hairColor", "facialHairColor", "clothesColor", "skinColor"] as const;

export type AvatarAttr = (typeof AVATAR_ENUM_ATTRS)[number] | (typeof AVATAR_COLOR_ATTRS)[number];

/**
 * Valores válidos por atributo, extraídos del schema de `@dicebear/avataaars`
 * 9.4.2. Los colores son hex SIN `#` (así los espera DiceBear).
 */
export const AVATAR_OPTIONS: Record<AvatarAttr, string[]> = {
  top: [
    "hat", "hijab", "turban", "winterHat1", "winterHat02", "winterHat03", "winterHat04",
    "bob", "bun", "curly", "curvy", "dreads", "frida", "fro", "froBand", "longButNotTooLong",
    "miaWallace", "shavedSides", "straight02", "straight01", "straightAndStrand", "dreads01",
    "dreads02", "frizzle", "shaggy", "shaggyMullet", "shortCurly", "shortFlat", "shortRound",
    "shortWaved", "sides", "theCaesar", "theCaesarAndSidePart", "bigHair",
  ],
  eyes: [
    "closed", "cry", "default", "eyeRoll", "happy", "hearts", "side", "squint", "surprised",
    "winkWacky", "wink", "xDizzy",
  ],
  eyebrows: [
    "angryNatural", "defaultNatural", "flatNatural", "frownNatural", "raisedExcitedNatural",
    "sadConcernedNatural", "unibrowNatural", "upDownNatural", "angry", "default", "raisedExcited",
    "sadConcerned", "upDown",
  ],
  mouth: [
    "concerned", "default", "disbelief", "eating", "grimace", "sad", "screamOpen", "serious",
    "smile", "tongue", "twinkle", "vomit",
  ],
  clothing: [
    "blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt", "hoodie", "overall",
    "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck",
  ],
  accessories: ["kurt", "prescription01", "prescription02", "round", "sunglasses", "wayfarers", "eyepatch"],
  facialHair: ["beardLight", "beardMajestic", "beardMedium", "moustacheFancy", "moustacheMagnum"],
  hairColor: ["a55728", "2c1b18", "b58143", "d6b370", "724133", "4a312c", "f59797", "ecdcbf", "c93305", "e8e1e1"],
  facialHairColor: ["a55728", "2c1b18", "b58143", "d6b370", "724133", "4a312c", "f59797", "ecdcbf", "c93305", "e8e1e1"],
  clothesColor: [
    "262e33", "65c9ff", "5199e4", "25557c", "e6e6e6", "929598", "3c4f5c", "b1e2ff", "a7ffc4",
    "ffafb9", "ffffb1", "ff488e", "ff5c5c", "ffffff",
  ],
  skinColor: ["614335", "d08b5b", "ae5d29", "edb98a", "ffdbb4", "fd9841", "f8d25c"],
};

/** Valores válidos para un atributo, desde el schema (nunca lista hardcodeada
 *  fuera de `AVATAR_OPTIONS`). */
export function avatarOptionValues(attr: AvatarAttr): string[] {
  return AVATAR_OPTIONS[attr] ?? [];
}

/** Seed aleatorio nuevo para el botón 🎲 / borradores nuevos. */
export function randomAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Objeto de opciones que DiceBear consume, construido desde el config y el seed
 * de respaldo. Puro — lo usa `avatarToSvg` y puede usarse para probar/derivar.
 * Espeja la lógica de `agentAvatarUri` del web (atributos → arrays de 1 valor;
 * accessories/facialHair fuerzan probabilidad 100 cuando están presentes).
 */
export function buildAvatarOptions(
  config: AvatarConfig | undefined | null,
  fallbackSeed: string,
): Record<string, unknown> {
  const cfg = config ?? {};
  const options: Record<string, unknown> = { seed: cfg.seed || fallbackSeed || "agent" };
  for (const attr of [...AVATAR_ENUM_ATTRS, ...AVATAR_COLOR_ATTRS]) {
    const v = cfg[attr];
    if (v) options[attr] = [v];
  }
  if (cfg.accessories) options.accessoriesProbability = 100;
  if (cfg.facialHair) options.facialHairProbability = 100;
  return options;
}

/**
 * DiceBear envuelve TODO el dibujo en `<g mask="url(#viewboxMask)">` con un
 * `<mask id="viewboxMask">` PELADO (sin `maskUnits`) cuya única intención es
 * recortar el arte al viewBox. En el navegador (`<img>`) eso es inofensivo: el
 * default SVG de la región de máscara es `-10%…120%` sobre la bbox, así que la
 * figura entra completa. Pero react-native-svg (`Mask.tsx`) usa por defecto
 * `maskUnits = objectBoundingBox` con región `0% 0% 100% 100%` → ciñe la máscara
 * a la BOUNDING BOX del contenido en vez del viewBox y RECORTA la figura dentro
 * del círculo (esa es la causa real del corte, NO el `width`/`height` de la raíz,
 * que ya se quitó). Reescribimos la máscara a `userSpaceOnUse` con la región =
 * viewBox completo: entonces el rect blanco cubre todo el lienzo, la máscara es
 * un no-op de recorte-al-viewBox y RN pinta el avatar entero (idéntico al web).
 */
function fixViewboxMaskForRn(svg: string): string {
  const vb = svg.match(/viewBox="([\d.\s+-]+)"/);
  const parts = vb ? vb[1].trim().split(/\s+/) : [];
  const w = parts[2] ?? "280";
  const h = parts[3] ?? "280";
  return svg.replace(
    /<mask id="viewboxMask">/,
    `<mask id="viewboxMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">`,
  );
}

/**
 * SVG del Avataaars como STRING, generado en proceso con DiceBear (sin red).
 * Determinista por (config, fallbackSeed): mismo agente ⇒ mismo avatar. Se pinta
 * con `<SvgXml xml={...} width height />`; si por lo que sea DiceBear lanzara,
 * AgentAvatar (W6) cae al icono Bot de respaldo.
 *
 * IMPORTANTE — NO se hornea `size` en las opciones (igual que el web, que nunca
 * lo pasa): con `size` DiceBear escribe `width`/`height` fijos en la raíz del
 * SVG y, bajo `<SvgXml>` (react-native-svg), esos px chocan con las props
 * width/height del componente y el contenido deja de escalar por el viewBox
 * (280×280). Sin `size` el SVG queda solo con `viewBox`, así
 * `<SvgXml width={size} height={size} />` lo escala completo al círculo. El
 * parámetro se conserva por compat de la firma pero solo alimenta la memoización
 * del componente. Además normalizamos el `viewboxMask` para react-native-svg
 * (ver `fixViewboxMaskForRn`), que es lo que realmente recortaba la figura. */
export function buildAvatarSvg(
  config: AvatarConfig | undefined | null,
  _size = 96,
  fallbackSeed = "agent",
): string {
  const svg = createAvatar(avataaars, buildAvatarOptions(config, fallbackSeed)).toString();
  return fixViewboxMaskForRn(svg);
}
