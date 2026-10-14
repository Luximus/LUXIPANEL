import { useEffect, useRef } from "react";
import gsap from "gsap";

export type EnterAnimationStep = {
  selector: string;
  from?: gsap.TweenVars;
  duration?: number;
  delay?: number | string;
  stagger?: number;
  ease?: string;
};

/**
 * Runs a sequence of GSAP entrance tweens scoped to the returned ref.
 * Each step targets elements via CSS selector inside the scope.
 */
export function useEnterAnimation<T extends HTMLElement = HTMLDivElement>(steps: EnterAnimationStep[]) {
  const scopeRef = useRef<T | null>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out", duration: 0.45 } });
      for (const step of steps) {
        const targets = scope.querySelectorAll(step.selector);
        if (targets.length === 0) continue;
        tl.from(
          targets,
          {
            ...(step.from ?? { opacity: 0, y: 16 }),
            duration: step.duration ?? 0.45,
            ease: step.ease ?? "power2.out",
            stagger: step.stagger ?? 0,
            clearProps: "transform,opacity",
          },
          step.delay !== undefined ? step.delay : ">-0.2",
        );
      }
    }, scope);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return scopeRef;
}
