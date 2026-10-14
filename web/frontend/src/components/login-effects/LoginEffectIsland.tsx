// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Single statically-imported React island that renders the selected login
// background effect. AuthLayout mounts ONE of these with `client:load`, passing
// the resolved effect id + already-coerced/adapted props. The effect itself is
// `lazy()`-loaded so only the chosen effect's chunk is shipped to /login.
//
// Why a wrapper: Astro can only treat a *statically-imported* component as a
// hydration island. Rendering `<DynamicComp client:load />` directly SSRs the
// markup but never ships client JS, so the canvas/WebGL animation never runs.
import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from "react";
import { LOGIN_EFFECT_LOADERS } from "./loaders";
import { DEFAULT_LOGIN_EFFECT_ID } from "@/lib/login-effects/registry";

interface Props {
  effectId: string;
  effectProps: Record<string, unknown>;
}

export default function LoginEffectIsland({ effectId, effectProps }: Props) {
  const [failedEffect, setFailedEffect] = useState<string | null>(null);
  useEffect(() => setFailedEffect(null), [effectId]);
  const activeEffectId = failedEffect === effectId ? DEFAULT_LOGIN_EFFECT_ID : effectId;
  const Effect = useMemo<ComponentType<any>>(() => {
    const loader = LOGIN_EFFECT_LOADERS[activeEffectId] ?? LOGIN_EFFECT_LOADERS[DEFAULT_LOGIN_EFFECT_ID];
    return lazy(loader);
  }, [activeEffectId]);

  // These two backgrounds need WebGPU. Their upstream onError callback fires
  // when no adapter is available; keep the page animated with the default.
  const webGpuProps = activeEffectId === effectId && (effectId === "aero_shards" || effectId === "shape_waves")
    ? { onError: () => setFailedEffect(effectId) }
    : {};

  return (
    <div className="h-full w-full">
      <Suspense fallback={null}>
        <Effect {...(activeEffectId === effectId ? effectProps : {})} {...webGpuProps} />
      </Suspense>
    </div>
  );
}
