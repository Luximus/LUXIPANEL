import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View, useWindowDimensions } from "react-native";
import { Canvas, Group, Image, Skia, makeImageFromView, type SkImage } from "@shopify/react-native-skia";
import { cancelAnimation, Easing, runOnJS, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { installThemeTransition, cancelThemeTransition } from "../hooks/useTheme";
import { useAmbientMotion } from "../hooks/useAmbientMotion";
import { createThemeTransition, revealGeometry, THEME_TRANSITION_MS, type ThemeOrigin } from "./theme-transition";

type Snapshot = { image: SkImage; width: number; height: number; x: number; y: number; radius: number };

/** The live tree is never duplicated, remounted or replaced by the transition. */
export function ThemeTransitionProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<View>(null);
  const dimensions = useWindowDimensions();
  const allowed = useAmbientMotion();
  const current = useRef({ dimensions, allowed });
  current.current = { dimensions, allowed };
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const ready = useRef<(() => void) | null>(null);
  const finished = useRef<(() => void) | null>(null);
  const presentation = useRef(0);
  const radius = useSharedValue(0);
  const centerX = useSharedValue(0), centerY = useSharedValue(0);
  const coordinator = useRef<ReturnType<typeof createThemeTransition<SkImage>> | null>(null);
  if (!coordinator.current) coordinator.current = createThemeTransition<SkImage>({
    capture: async () => { const image = await makeImageFromView(ref); if (!image) throw new Error("Empty theme snapshot"); return image; },
    present: (image: SkImage, origin?: ThemeOrigin) => new Promise<void>((resolve, reject) => {
      const epoch = presentation.current;
      ready.current = resolve;
      // Points are measured in window coordinates by the actual control.
      if (!ref.current) { reject(new Error("Theme surface unmounted")); return; }
      ref.current.measureInWindow((left, top, width, height) => {
        if (presentation.current !== epoch) { resolve(); return; }
        if (width <= 0 || height <= 0) { reject(new Error("Empty theme surface")); return; }
        const geometry = revealGeometry(width, height, origin && { x: origin.x - left, y: origin.y - top });
        radius.value = 0; centerX.value = geometry.x; centerY.value = geometry.y;
        ready.current = resolve;
        setSnapshot({ image, width, height, ...geometry });
      });
    }),
    animate: () => new Promise<void>(resolve => {
      finished.current = resolve;
      // Wait for the updated live theme to commit below the opaque snapshot.
      requestAnimationFrame(() => {
        if (finished.current !== resolve) { resolve(); return; }
        radius.value = withTiming(currentRadius.current, { duration: THEME_TRANSITION_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) }, () => runOnJS(resolve)());
      });
    }),
    hide: () => {
      ++presentation.current;
      cancelAnimation(radius);
      ready.current?.(); ready.current = null;
      finished.current?.(); finished.current = null;
      setSnapshot(null);
    },
    dispose: image => requestAnimationFrame(() => requestAnimationFrame(() => image.dispose())),
  });
  const currentRadius = useRef(0);
  useLayoutEffect(() => {
    if (snapshot) { currentRadius.current = snapshot.radius; ready.current?.(); ready.current = null; }
  }, [snapshot]);
  useEffect(() => installThemeTransition((apply, origin) => {
    if (!current.current.allowed) { apply(); return; }
    void coordinator.current!.run(apply, origin);
  }, () => coordinator.current!.cancel()), []);
  useEffect(() => { coordinator.current!.cancel(); }, [dimensions.width, dimensions.height, allowed]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") coordinator.current!.cancel(); });
    return () => { subscription.remove(); coordinator.current!.cancel(); };
  }, []);
  const clip = useDerivedValue(() => {
    const path = Skia.Path.Make();
    path.addCircle(centerX.value, centerY.value, Math.max(0.001, radius.value));
    return path;
  });
  return <View style={styles.fill}>
    <View ref={ref} collapsable={false} style={styles.fill}>{children}</View>
    {snapshot && <View style={styles.overlay} pointerEvents="auto" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={styles.fill}>
        <Group clip={clip} invertClip><Image image={snapshot.image} x={0} y={0} width={snapshot.width} height={snapshot.height} fit="fill" /></Group>
      </Canvas>
    </View>}
  </View>;
}

/** Async authentication/profile changes discard the image of the old context. */
export function ThemeTransitionScope({ value }: { value: string }) {
  useLayoutEffect(() => { cancelThemeTransition(); }, [value]);
  return null;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100000, elevation: 1000 } });
