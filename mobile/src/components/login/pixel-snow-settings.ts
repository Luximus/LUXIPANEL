export function pixelSnowSettings(layout: Record<string, string>, light: boolean, accent: string) {
  const number = (key: string, fallback: number, min: number, max: number) => {
    const raw = layout[`layout_login_pixel_snow_${key}`];
    const value = raw?.trim() ? Number(raw) : NaN;
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  };
  const configured = layout.layout_login_pixel_snow_color;
  // White flakes need a contrasting tint on the native light background.
  const color = /^#[\da-f]{6}$/i.test(configured ?? "") && (!light || configured.toLowerCase() !== "#ffffff")
    ? configured : light ? accent : "#ffffff";
  const variant = layout.layout_login_pixel_snow_variant;
  return {
    enabled: !["false", "0", "off"].includes((layout.layout_login_background_enabled ?? "true").toLowerCase()),
    color,
    flakeSize: number("flake_size", 0.01, 0.001, 0.05),
    minFlakeSize: number("min_flake_size", 1.25, 0.1, 8),
    pixelResolution: number("pixel_resolution", 200, 50, 500),
    speed: number("speed", 1.25, 0, 5),
    depthFade: number("depth_fade", 8, 1, 20),
    farPlane: number("far_plane", 20, 5, 50),
    brightness: number("brightness", 1, 0.1, 3) * (light ? 0.3 : 0.65),
    gamma: number("gamma", 0.4545, 0.1, 3),
    density: number("density", 0.3, 0.1, 1),
    variant: variant === "round" ? 1 : variant === "snowflake" ? 2 : 0,
    direction: number("direction", 125, 0, 360) * Math.PI / 180,
  };
}
