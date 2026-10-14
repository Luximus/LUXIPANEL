// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { styles } from "./PulseDot.styles";

/** Punto pulsante (paridad con los dots `animate-pulse` de la web): un punto
 *  sólido con un anillo que se expande y desvanece en bucle. */
export function PulseDot({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  return (
    <View style={styles.pulseDotWrap}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: color, transform: [{ scale }], opacity }]} />
      <View style={[styles.pulseCore, { backgroundColor: color }]} />
    </View>
  );
}
