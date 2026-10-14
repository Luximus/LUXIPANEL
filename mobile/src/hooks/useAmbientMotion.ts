import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";

/** Also reacts to accessibility changes while the application is running. */
export function useAmbientMotion() {
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    let alive = true;
    let revision = 0;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (alive && revision === 0) setReduced(value);
    }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { revision++; setReduced(value); });
    const app = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => { alive = false; motion.remove(); app.remove(); };
  }, []);
  return foreground && !reduced;
}
