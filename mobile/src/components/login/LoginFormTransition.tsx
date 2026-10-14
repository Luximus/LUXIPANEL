import React, { useLayoutEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useAmbientMotion } from "../../hooks/useAmbientMotion";

/** Animate the form only; keep the background and shared branding mounted. */
export function LoginFormTransition({ mode, children }: { mode: string; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(1)).current;
  const previousMode = useRef(mode);
  const motion = useAmbientMotion();
  useLayoutEffect(() => {
    const changed = previousMode.current !== mode;
    previousMode.current = mode;
    if (!motion || !changed) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [mode, motion, progress]);
  return <Animated.View style={{ gap: 14, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>{children}</Animated.View>;
}
