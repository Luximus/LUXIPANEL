// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Paginación cliente de las listas del drawer (proyectos, árboles de agentes y
 * de "Sueltos / Proyectos"). Extraído 1:1 de `ServerAssistantPane.tsx` (fase A3).
 */
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import type { ThemeTokens } from "../../../theme/colors";
import type { AssistantStrings } from "../types";
import { styles } from "./pager.styles";

// Paginación de 5/página en cada nivel de los árboles (top + anidados), como en
// el panel.
export const AGENTS_PER_PAGE = 5;

/** Pie de paginación de una lista de proyectos/subproyectos (chevron izq/der con
 *  estado deshabilitado), espejo del `ProjectsPager` de la web. */
export function ProjectsPagerRN({ page, pageCount, t, tokens, onPrev, onNext }: {
  page: number; pageCount: number; t: AssistantStrings; tokens: ThemeTokens; onPrev: () => void; onNext: () => void;
}) {
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;
  return (
    <View style={styles.pagerRow}>
      <Pressable onPress={onPrev} disabled={!canPrev} accessibilityLabel={t.pagerPrev ?? "Página anterior"} hitSlop={6} style={[styles.pagerBtn, { opacity: canPrev ? 1 : 0.35 }]}>
        <ChevronLeft size={14} color={tokens.textMuted} />
      </Pressable>
      <Text style={[styles.pagerText, { color: tokens.textMuted }]}>{`${page + 1} / ${pageCount}`}</Text>
      <Pressable onPress={onNext} disabled={!canNext} accessibilityLabel={t.pagerNext ?? "Página siguiente"} hitSlop={6} style={[styles.pagerBtn, { opacity: canNext ? 1 : 0.35 }]}>
        <ChevronRight size={14} color={tokens.textMuted} />
      </Pressable>
    </View>
  );
}

/** Paginación cliente de una lista: corta `items` en páginas de `size` y expone
 *  la página visible + navegación. Espejo de `usePaged` web: al cambiar
 *  `resetKey` (longitud/scope de la lista, o navegación a otra rama) vuelve a la
 *  página 1 para no quedar "atrapado" en una página que ya no existe. */
const PAGER_SIZE = 6;
export function usePager<T>(items: T[], resetKey: unknown = null, size = PAGER_SIZE, defaultLast = false) {
  // `null` = el usuario aún no ha paginado ⇒ vale la página por defecto.
  const [page, setPage] = useState<number | null>(null);
  // Reset a la página por defecto cuando cambia la longitud/scope de la lista.
  useEffect(() => { setPage(null); }, [resetKey, size]);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  // `defaultLast`: listas ordenadas con lo más reciente AL FINAL (layout invertido
  // del árbol de agentes). Sin esto el pager abría en la página 1 = lo más viejo,
  // justo lo contrario de lo que busca ese layout.
  const fallback = defaultLast ? pageCount - 1 : 0;
  const current = Math.min(page ?? fallback, pageCount - 1);
  return {
    visible: items.slice(current * size, current * size + size),
    page: current,
    pageCount,
    hasPager: items.length > size,
    prev: () => setPage(Math.max(0, current - 1)),
    next: () => setPage(Math.min(pageCount - 1, current + 1)),
  };
}

/** Páginas por-clave de las listas anidadas del árbol (chats propios, subs…). */
export function useNestedPages() {
  const [pages, setPages] = useState<Record<string, number>>({});
  return {
    /** `fallback`: página inicial mientras el usuario no haya paginado esa clave
     *  (la última en las listas invertidas: lo más reciente va al final). */
    get: (k: string, fallback = 0) => pages[k] ?? fallback,
    set: (k: string, p: number) => setPages((prev) => ({ ...prev, [k]: Math.max(0, p) })),
  };
}
