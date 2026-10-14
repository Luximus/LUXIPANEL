import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAmbientMotion } from "../../hooks/useAmbientMotion";
import { getThemeTokens, withAlpha } from "../../theme/colors";
import { pixelSnowShader } from "./pixel-snow-shader";
import { pixelSnowSettings } from "./pixel-snow-settings";

const effect = Skia.RuntimeEffect.Make(pixelSnowShader);

export function PixelSnowBackground({ layout, dark }: { layout: Record<string, string>; dark: boolean }) {
  const colors = getThemeTokens(dark);
  const settings = useMemo(() => pixelSnowSettings(layout, !dark, colors.brand), [layout, dark, colors.brand]);
  const motion = useAmbientMotion();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const time = useSharedValue(0);
  const frame = useFrameCallback(({ timeSincePreviousFrame }) => {
    // Advance on every display frame; the old threshold produced ~20 FPS
    // on 60 Hz devices and visible steps while typing or switching forms.
    time.value += Math.min(timeSincePreviousFrame ?? 0, 64) / 1000;
  }, false);
  useEffect(() => {
    frame.setActive(motion && settings.enabled && settings.speed > 0);
    return () => frame.setActive(false);
  }, [motion, settings.enabled, settings.speed, frame]);
  const color = useMemo(() => Array.from(Skia.Color(settings.color)).slice(0, 3), [settings.color]);
  const uniforms = useDerivedValue(() => ({
    uTime: time.value, uResolution: [size.width, size.height], uColor: color,
    uFlakeSize: settings.flakeSize, uMinFlakeSize: settings.minFlakeSize,
    uPixelResolution: settings.pixelResolution, uSpeed: settings.speed,
    uDepthFade: settings.depthFade, uFarPlane: settings.farPlane,
    uBrightness: settings.brightness, uGamma: settings.gamma, uDensity: settings.density,
    uVariant: settings.variant, uDirection: settings.direction, uOpacity: dark ? 0.45 : 0.24,
  }), [settings, size, color]);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={StyleSheet.absoluteFill} onLayout={({ nativeEvent: { layout } }) => setSize(previous =>
      previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height })}>
    <LinearGradient colors={dark ? [colors.bgPrimary, colors.bgCardSolid, colors.bgPrimary] : [colors.bgPrimary, colors.bgSecondary, colors.bgPrimary]}
      locations={[0, 0.52, 1]} style={StyleSheet.absoluteFill} />
    {!settings.enabled && layout.layout_login_background_fallback_color
      ? <View style={[StyleSheet.absoluteFill, { backgroundColor: layout.layout_login_background_fallback_color }]} /> : null}
    {effect && settings.enabled && <Canvas style={StyleSheet.absoluteFill}><Fill><Shader source={effect} uniforms={uniforms} /></Fill></Canvas>}
    <LinearGradient colors={[withAlpha(colors.bgPrimary, 0.1), withAlpha(colors.bgPrimary, dark ? 0.55 : 0.3), withAlpha(colors.bgPrimary, 0.15)]}
      style={StyleSheet.absoluteFill} />
  </View>;
}
