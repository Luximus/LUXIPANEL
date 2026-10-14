// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState } from "react";
import { PROJECTS_PAGE } from "./helpers";

/** Client-side pager for the project / subproject / search lists: splits the
 *  items into pages of `step` and exposes the current page + navigation. Resets
 *  to page 1 whenever `resetKey` changes (e.g. entering another project, or a
 *  new search). */
export function usePaged<T>(items: T[], resetKey: unknown, step = PROJECTS_PAGE) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [resetKey, step]);
  const pageCount = Math.max(1, Math.ceil(items.length / step));
  const current = Math.min(page, pageCount - 1);
  return {
    visible: items.slice(current * step, current * step + step),
    page: current,
    pageCount,
    hasPager: items.length > step,
    prev: () => setPage((p) => Math.max(0, p - 1)),
    next: () => setPage((p) => Math.min(pageCount - 1, p + 1)),
  };
}
