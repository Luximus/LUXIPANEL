import { useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

export type EnterAnimationStep = {
  duration?: number;
  delay?: number;
  /** Initial Y offset in dp; defaults to 16 (slide-up). */
  fromY?: number;
};

export type EnterAnimationResult = {
  opacity: Animated.Value;
  translateY: Animated.Value;
  /** Convenience helper to spread on Animated.View style. */
  style: Animated.WithAnimatedObject<ViewStyle>;
};

/**
 * RN equivalent of the desktop GSAP entrance helper. Returns animated values
 * the caller spreads onto an Animated.View.
 */
export function useEnterAnimation(step: EnterAnimationStep = {}): EnterAnimationResult {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(step.fromY ?? 16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: step.duration ?? 450,
        delay: step.delay ?? 0,
        easing: Easing.out(Easing.poly(2)),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: step.duration ?? 450,
        delay: step.delay ?? 0,
        easing: Easing.out(Easing.poly(2)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, step.delay, step.duration]);

  return {
    opacity,
    translateY,
    style: { opacity, transform: [{ translateY }] } as Animated.WithAnimatedObject<ViewStyle>,
  };
}
