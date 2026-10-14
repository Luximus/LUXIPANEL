import { expect, it } from "vitest";
import { pixelSnowSettings } from "./pixel-snow-settings";
it("supports background disabled by the deployed server", () => {
  expect(pixelSnowSettings({layout_login_background_enabled:"false"}, false, "#63e6ae").enabled).toBe(false);
});
it("reuses the deployed Pixel Snow controls and bounds malformed values", () => {
  const props = pixelSnowSettings({layout_login_pixel_snow_speed:"2",layout_login_pixel_snow_density:"Infinity",layout_login_pixel_snow_direction:"90",layout_login_pixel_snow_variant:"round",layout_login_pixel_snow_far_plane:"500"}, false,"#63e6ae");
  expect(props.speed).toBe(2); expect(props.density).toBe(.3); expect(props.direction).toBe(Math.PI/2); expect(props.variant).toBe(1); expect(props.farPlane).toBe(50);
});
it("keeps white flakes legible in light mode and honors a custom color", () => {
  expect(pixelSnowSettings({layout_login_pixel_snow_color:"#ffffff"},true,"#151c2c").color).toBe("#151c2c");
  expect(pixelSnowSettings({layout_login_pixel_snow_color:"#cc22ee"},true,"#151c2c").color).toBe("#cc22ee");
});
