// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  DEFAULT_LAYOUT_SETTINGS,
  normalizeLayoutSettings,
  pickLayoutSetting,
  getLayoutThemeVars,
  buildLayoutCss,
  buildLogoMap,
  sanitizeColor,
  sanitizeLength,
  sanitizeShadow,
  rejectDangerousCss,
} from "./layout-branding";
import { LUXISOFT_LAYOUT_PALETTE, paletteToSettings } from "./layout-palettes";

describe("normalizeLayoutSettings", () => {
  it("uses the Luxisoft console palette for both default modes", () => {
    const palette = paletteToSettings(LUXISOFT_LAYOUT_PALETTE);
    for (const [key, value] of Object.entries(palette)) {
      expect(DEFAULT_LAYOUT_SETTINGS[key]).toBe(value);
    }
    expect(getLayoutThemeVars({}, "light")["--primary"]).toBe("#151c2c");
    expect(getLayoutThemeVars({}, "light")["--ring"]).toBe("#24e1c5");
    expect(getLayoutThemeVars({}, "dark")["--background"]).toBe("#181b20");
    expect(getLayoutThemeVars({}, "dark")["--primary"]).toBe("#63e6ae");
    expect(getLayoutThemeVars({}, "dark")["--muted-foreground"]).toBe("#aab4af");
  });

  it("starts from the defaults when given null/empty", () => {
    const out = normalizeLayoutSettings(null);
    // default logo paths are also run through the panel-safe alias map
    expect(out.layout_logo).toBe("/panel/logo_300.webp");
    expect(out.layout_light_primary).toBe(DEFAULT_LAYOUT_SETTINGS.layout_light_primary);
  });

  it("overrides defaults with provided string values", () => {
    const out = normalizeLayoutSettings({ layout_light_primary: "#abcdef" });
    expect(out.layout_light_primary).toBe("#abcdef");
  });

  it("coerces numbers and booleans to strings, ignores other types", () => {
    const out = normalizeLayoutSettings({
      layout_login_letter_glitch_speed: 99,
      layout_login_background_enabled: false,
      bogus: { nested: true } as unknown as string,
    });
    expect(out.layout_login_letter_glitch_speed).toBe("99");
    expect(out.layout_login_background_enabled).toBe("false");
    expect(out.bogus).toBeUndefined();
  });

  it("rewrites well-known public asset paths to their panel-safe aliases", () => {
    const out = normalizeLayoutSettings({
      layout_favicon: "/favicon.ico",
      layout_logo: "/logo_300.webp",
    });
    expect(out.layout_favicon).toBe("/panel/favicon.ico");
    expect(out.layout_logo).toBe("/panel/logo_300.webp");
  });

  it("folds legacy per-slot logo keys into the single layout_logo", () => {
    const out = normalizeLayoutSettings({
      layout_logo_primary: "/logo_300.webp",
      layout_logo_sidebar: "/logo_150.webp",
      layout_logo_login: "/logo_300.webp",
      layout_logo_footer: "/logo_50.webp",
    });
    expect(out.layout_logo).toBe("/panel/logo_300.webp");
    expect(out.layout_logo_primary).toBeUndefined();
    expect(out.layout_logo_sidebar).toBeUndefined();
    expect(out.layout_logo_login).toBeUndefined();
    expect(out.layout_logo_footer).toBeUndefined();
  });

  it("lets an explicit layout_logo override any legacy slot", () => {
    const out = normalizeLayoutSettings({
      layout_logo: "/my-logo.webp",
      layout_logo_primary: "/logo_300.webp",
    });
    expect(out.layout_logo).toBe("/my-logo.webp");
    expect(out.layout_logo_primary).toBeUndefined();
  });
});

describe("pickLayoutSetting", () => {
  it("prefers the provided value, falls back to default, then empty string", () => {
    expect(pickLayoutSetting({ layout_radius: "2rem" }, "layout_radius")).toBe("2rem");
    expect(pickLayoutSetting({}, "layout_radius")).toBe(DEFAULT_LAYOUT_SETTINGS.layout_radius);
    expect(pickLayoutSetting({}, "does_not_exist")).toBe("");
  });
});

describe("getLayoutThemeVars", () => {
  it("maps brand primary into --primary / --brand in light mode", () => {
    const vars = getLayoutThemeVars({ layout_light_primary: "#112233" }, "light");
    expect(vars["--primary"]).toBe("#112233");
    expect(vars["--brand"]).toBe("#112233");
  });

  it("forces default neutral dark surfaces regardless of palette tint", () => {
    // Even if a palette tints the dark card, the container stays the default.
    const vars = getLayoutThemeVars({ layout_dark_card: "#990000" }, "dark");
    expect(vars["--card"]).toBe(DEFAULT_LAYOUT_SETTINGS.layout_dark_card);
  });

  it("still lets the brand accent follow the palette in dark mode", () => {
    const vars = getLayoutThemeVars({ layout_dark_primary: "#abcdef" }, "dark");
    expect(vars["--primary"]).toBe("#abcdef");
    expect(vars["--brand"]).toBe("#abcdef");
  });

  it("keeps light-mode derived fills subtle so custom and tornasol stay balanced", () => {
    const vars = getLayoutThemeVars({ layout_light_primary: "#22c55e" }, "light");
    expect(vars["--brand-dim"]).toBe("color-mix(in srgb, #22c55e 5%, transparent)");
    expect(vars["--brand-glow"]).toBe("color-mix(in srgb, #24e1c5 9%, transparent)");
    expect(vars["--ok-bg"]).toBe("color-mix(in srgb, #22c55e 4%, #ffffff 96%)");
    expect(vars["--badge-active-bg"]).toBe("color-mix(in srgb, #22c55e 6%, #ffffff 94%)");
    expect(vars["--card-hover"]).toBe("color-mix(in srgb, #ffffff 93%, #22c55e 7%)");
  });
});

describe("buildLayoutCss", () => {
  it("emits :root and .dark blocks with radius/shadow vars", () => {
    const css = buildLayoutCss(DEFAULT_LAYOUT_SETTINGS);
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
    expect(css).toContain(`--radius: ${DEFAULT_LAYOUT_SETTINGS.layout_radius};`);
    expect(css).toContain("--primary:");
  });
});

describe("CSS branding sanitizers (stored XSS hardening)", () => {
  describe("sanitizeColor", () => {
    it("passes legitimate hex and rgb/hsl values unchanged", () => {
      expect(sanitizeColor("#fff", "#000")).toBe("#fff");
      expect(sanitizeColor("#7c3aed", "#000")).toBe("#7c3aed");
      expect(sanitizeColor("#7c3aedff", "#000")).toBe("#7c3aedff");
      expect(sanitizeColor("rgb(15, 23, 42)", "#000")).toBe("rgb(15, 23, 42)");
      expect(sanitizeColor("rgba(15, 23, 42, 0.6)", "#000")).toBe("rgba(15, 23, 42, 0.6)");
      expect(sanitizeColor("hsl(270, 50%, 40%)", "#000")).toBe("hsl(270, 50%, 40%)");
    });

    it("falls back to default for breakout / malformed values", () => {
      expect(sanitizeColor("</style><script>alert(1)</script>", "#000")).toBe("#000");
      expect(sanitizeColor("red;}body{display:none", "#000")).toBe("#000");
      expect(sanitizeColor("url(javascript:alert(1))", "#000")).toBe("#000");
      expect(sanitizeColor("red", "#000")).toBe("#000"); // named colors not whitelisted
      expect(sanitizeColor("#ggg", "#000")).toBe("#000");
      expect(sanitizeColor("rgb(1,2)", "#000")).toBe("#000");
    });
  });

  describe("sanitizeLength", () => {
    it("passes legitimate number+unit lengths unchanged", () => {
      expect(sanitizeLength("0.95rem", "1rem")).toBe("0.95rem");
      expect(sanitizeLength("12px", "1rem")).toBe("12px");
      expect(sanitizeLength("-2em", "1rem")).toBe("-2em");
      expect(sanitizeLength("50%", "1rem")).toBe("50%");
    });

    it("falls back to default for breakout / malformed values", () => {
      expect(sanitizeLength("12px;color:url(javascript:alert(1))", "1rem")).toBe("1rem");
      expect(sanitizeLength("12pt", "1rem")).toBe("1rem"); // disallowed unit
      expect(sanitizeLength("calc(1px + 1px)", "1rem")).toBe("1rem");
      expect(sanitizeLength("12", "1rem")).toBe("1rem"); // no unit
    });
  });

  describe("sanitizeShadow", () => {
    it("passes the legitimate default shadows unchanged", () => {
      expect(
        sanitizeShadow(DEFAULT_LAYOUT_SETTINGS.layout_shadow, "none"),
      ).toBe(DEFAULT_LAYOUT_SETTINGS.layout_shadow);
      expect(
        sanitizeShadow(DEFAULT_LAYOUT_SETTINGS.layout_modal_shadow, "none"),
      ).toBe(DEFAULT_LAYOUT_SETTINGS.layout_modal_shadow);
      expect(sanitizeShadow("inset 0 0 4px #000", "none")).toBe("inset 0 0 4px #000");
      expect(sanitizeShadow("none", "x")).toBe("none");
    });

    it("falls back to default for breakout / malformed values", () => {
      expect(sanitizeShadow("0 0 1px #000;}body{display:none", "none")).toBe("none");
      expect(sanitizeShadow("0 0 1px url(javascript:alert(1))", "none")).toBe("none");
      expect(sanitizeShadow("0 0 1px rgb(1,2)", "none")).toBe("none");
    });
  });

  describe("rejectDangerousCss", () => {
    it("returns the value when it has no breakout chars", () => {
      expect(rejectDangerousCss("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
      expect(rejectDangerousCss("color-mix(in srgb, #fff 60%, #000 40%)")).toBe(
        "color-mix(in srgb, #fff 60%, #000 40%)",
      );
    });

    it("returns null for values containing < > { } ; : \\ or newlines", () => {
      expect(rejectDangerousCss("</style>")).toBeNull();
      expect(rejectDangerousCss("a;b")).toBeNull();
      expect(rejectDangerousCss("a{b}")).toBeNull();
      expect(rejectDangerousCss("a:b")).toBeNull();
      expect(rejectDangerousCss("a\nb")).toBeNull();
    });
  });

  describe("buildLayoutCss end-to-end", () => {
    it("never emits a closing </style> or stray rule braces from hostile values", () => {
      const css = buildLayoutCss({
        ...DEFAULT_LAYOUT_SETTINGS,
        layout_light_primary: "</style><script>alert(1)</script>",
        layout_dark_primary: "red;}body{display:none}",
        layout_radius: "12px;color:url(javascript:alert(1))",
        layout_modal_backdrop: "rgba(0,0,0,.6);}*{color:red",
      });
      expect(css).not.toContain("</style>");
      expect(css).not.toContain("<script>");
      expect(css).not.toContain("display:none");
      expect(css).not.toContain("javascript:");
      // Legitimate fallbacks still rendered.
      expect(css).toContain(`--radius: ${DEFAULT_LAYOUT_SETTINGS.layout_radius};`);
      expect(css).toContain(`--primary: ${DEFAULT_LAYOUT_SETTINGS.layout_light_primary};`);
    });

    it("preserves legitimate branding values", () => {
      const css = buildLayoutCss({
        ...DEFAULT_LAYOUT_SETTINGS,
        layout_light_primary: "#112233",
        layout_radius: "1.25rem",
      });
      expect(css).toContain("--primary: #112233;");
      expect(css).toContain("--radius: 1.25rem;");
    });
  });
});

describe("buildLogoMap", () => {
  it("uses the single layout_logo for every visual surface, including the favicon", () => {
    const map = buildLogoMap(DEFAULT_LAYOUT_SETTINGS);
    expect(map).toEqual({
      primary: DEFAULT_LAYOUT_SETTINGS.layout_logo,
      sidebar: DEFAULT_LAYOUT_SETTINGS.layout_logo,
      login: DEFAULT_LAYOUT_SETTINGS.layout_logo,
      footer: DEFAULT_LAYOUT_SETTINGS.layout_logo,
      favicon: DEFAULT_LAYOUT_SETTINGS.layout_logo,
    });
  });
});
