// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, Platform, View } from "react-native";
import { terminalKeyboardOverlap } from "../lib/terminal-layout";

/** Anchor the accessory bar to the visible keyboard without relying on the
 * keyboard mode of the installed development client or subtracting IME twice. */
export function useTerminalKeyboard(screenTopInset = 0) {
  const surfaceRef = useRef<View>(null);
  const [frame, setFrame] = useState<number | null>(() => Keyboard.metrics?.()?.screenY ?? null);
  const [overlap, setOverlap] = useState(0);
  const raf = useRef<number | null>(null);
  const measure = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      surfaceRef.current?.measureInWindow((_x, y, _width, height) => {
        // Android's measureInWindow subtracts the visible window's top inset
        // (ReactSurfaceView/RootViewUtil); Keyboard.screenY is a screen value
        // (ReactRootView). Restore that inset before comparing the frames.
        const screenY = y + (Platform.OS === "android" ? screenTopInset : 0);
        setOverlap(terminalKeyboardOverlap({ y: screenY, height }, frame));
      });
    });
  }, [frame, screenTopInset]);

  useEffect(() => {
    const change = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", event => {
      setFrame(event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null);
    });
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setFrame(null);
      setOverlap(0);
    });
    return () => { change.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    measure();
    const dimensions = Dimensions.addEventListener("change", measure);
    return () => {
      dimensions.remove();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [measure]);

  return { surfaceRef, onSurfaceLayout: measure, keyboardOpen: frame !== null, overlap };
}
