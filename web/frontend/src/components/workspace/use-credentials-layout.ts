import { useLayoutEffect } from "react";
import { useViewContext } from "./view-context";
import { useModuleVisibility } from "./module-visibility";

/** Position the two columns independently without moving React-owned cards. */
export function useCredentialsLayout(enabled: boolean) {
  const { scope } = useViewContext();
  const visible = useModuleVisibility();
  useLayoutEffect(() => {
    if (!enabled || !visible) return;
    const panel = scope.root.querySelector<HTMLElement>("#panel-credentials");
    if (!panel) return;
    const cards = new Set<HTMLElement>();
    let frame = 0;
    const reset = (card: HTMLElement) => {
      card.style.removeProperty("grid-column");
      card.style.removeProperty("grid-row");
    };
    const layout = () => {
      frame = 0;
      if (!panel.getBoundingClientRect().width) return;
      panel.setAttribute("data-credentials-masonry", "");
      const gap = parseFloat(getComputedStyle(panel).columnGap) || 16;
      const rows = [1, 1];
      let index = 0;
      for (const card of cards) {
        const height = card.getBoundingClientRect().height;
        if (!height) {
          reset(card);
          continue;
        }
        const fullWidth = card.id === "cred-empty";
        const column = fullWidth ? 0 : index++ % 2;
        const span = Math.max(1, Math.ceil(height));
        const gridColumn = fullWidth ? "1 / -1" : String(column + 1);
        const gridRow = `${rows[column]} / span ${span}`;
        if (card.style.gridColumn !== gridColumn) card.style.gridColumn = gridColumn;
        if (card.style.gridRow !== gridRow) card.style.gridRow = gridRow;
        rows[column] += span + Math.ceil(gap);
        if (fullWidth) rows[1] = rows[0];
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };
    const resize = new ResizeObserver(schedule);
    const syncCards = () => {
      const next = new Set(panel.querySelectorAll<HTMLElement>("#cred-empty, [data-lxp-collapse]"));
      for (const card of cards) if (!next.has(card)) {
        resize.unobserve(card);
        reset(card);
      }
      for (const card of next) if (!cards.has(card)) resize.observe(card);
      cards.clear();
      for (const card of next) cards.add(card);
    };
    const mutations = new MutationObserver(records => {
      if (records.some(record => record.type === "childList")) syncCards();
      schedule();
    });
    syncCards();
    resize.observe(panel);
    // Includes tab visibility and module gating, but excludes our style writes.
    mutations.observe(scope.root, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "hidden"],
    });
    layout();
    return () => {
      mutations.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      panel.removeAttribute("data-credentials-masonry");
      cards.forEach(reset);
    };
  }, [scope, enabled, visible]);
}
