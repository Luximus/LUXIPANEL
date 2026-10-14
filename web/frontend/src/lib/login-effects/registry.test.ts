import { describe, expect, it } from "vitest";
import { LOGIN_EFFECTS, LOGIN_EFFECTS_BY_ID } from "./registry";
import { NEW_LOGIN_EFFECTS } from "./effects";
import { LOGIN_EFFECT_LOADERS } from "@/components/login-effects/loaders";
import { resolveLoginEffect } from "./resolve";

describe("React Bits background catalog", () => {
  it("has one lazy loader and unique saved keys for every selectable effect", () => {
    expect(LOGIN_EFFECTS).toHaveLength(57);
    expect(NEW_LOGIN_EFFECTS).toHaveLength(16);
    expect(new Set(LOGIN_EFFECTS.map((effect) => effect.id)).size).toBe(LOGIN_EFFECTS.length);
    expect(Object.keys(LOGIN_EFFECT_LOADERS).sort()).toEqual(LOGIN_EFFECTS.map((effect) => effect.id).sort());
    expect(LOGIN_EFFECTS.filter((effect) => effect.requiresWebGpu).map((effect) => effect.id).sort())
      .toEqual(["aero_shards", "shape_waves"]);
    for (const effect of LOGIN_EFFECTS) {
      expect(LOGIN_EFFECTS_BY_ID[effect.id]).toBe(effect);
      expect(new Set(effect.props.map((prop) => prop.storageKey)).size).toBe(effect.props.length);
    }
  });

  it("resolves new colors and panel settings without mixing the two scopes", () => {
    const ferrofluid = resolveLoginEffect({
      layout_login_background_type: "ferrofluid",
      layout_login_ferrofluid_color1: "#123456",
    });
    expect(ferrofluid.effect?.id).toBe("ferrofluid");
    expect(ferrofluid.props.colors).toEqual(["#123456", "#FFFFFF", "#FFFFFF"]);

    const panel = resolveLoginEffect({
      layout_panel_background_type: "crt_warp",
      layout_panel_crt_warp_speed: "1.2",
      layout_login_crt_warp_speed: "0.2",
    }, "panel");
    expect(panel.effect?.id).toBe("crt_warp");
    expect(panel.props.speed).toBe(1.2);
  });

  it("applies saved color and size controls to the current React Bits prop names", () => {
    const aurora = resolveLoginEffect({
      layout_login_background_type: "aurora",
      layout_login_aurora_color1: "#112233",
    });
    expect(aurora.props.colorStops).toEqual(["#112233", "#B497CF", "#5227FF"]);

    const grid = resolveLoginEffect({
      layout_login_background_type: "shape_grid",
      layout_login_shape_grid_size: "64",
      layout_login_shape_grid_hover_color: "#abcdef",
    });
    expect(grid.props.squareSize).toBe(64);
    expect(grid.props.hoverFillColor).toBe("#abcdef");
  });
});
