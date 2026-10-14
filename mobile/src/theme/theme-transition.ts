export type ThemeOrigin = { x: number; y: number };
export const THEME_TRANSITION_MS = 380;

export function revealGeometry(width: number, height: number, origin?: ThemeOrigin) {
  const x = Math.max(0, Math.min(width, Number.isFinite(origin?.x) ? origin!.x : width / 2));
  const y = Math.max(0, Math.min(height, Number.isFinite(origin?.y) ? origin!.y : height / 2));
  return { x, y, radius: Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) };
}

/** Owns a single capture/reveal. Cancellation never commits a late theme. */
export function createThemeTransition<T>(effects: {
  capture: () => Promise<T>;
  present: (image: T, origin?: ThemeOrigin) => Promise<void>;
  animate: () => Promise<void>;
  hide: () => void;
  dispose: (image: T) => void;
}) {
  let sequence = 0;
  let active: number | null = null;
  return {
    async run(apply: () => void, origin?: ThemeOrigin) {
      if (active !== null) return;
      const id = ++sequence;
      active = id;
      let image: T | undefined;
      let committed = false;
      try {
        image = await effects.capture();
        if (active !== id) return;
        await effects.present(image, origin);
        if (active !== id) return;
        apply();
        committed = true;
        await effects.animate();
      } catch {
        // Capture/render failures must never prevent changing the theme.
        if (active === id && !committed) apply();
      } finally {
        if (active === id) { active = null; effects.hide(); }
        if (image !== undefined) effects.dispose(image);
      }
    },
    cancel() { active = null; ++sequence; effects.hide(); },
  };
}
