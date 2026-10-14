// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  buildTier1Command,
  buildTier2Command,
  probeSubstrate,
  probeTier2,
  reapOrphans,
  tier2PropertySet,
  pdeathsigSetprivFlags,
  PIPS_UNIT_PREFIX,
  type Tier2Spec,
} from "./substrate.js";
import { panelConfigDir } from "../../config/paths.js";

describe("preview-sandbox substrate Tier-1 command builder", () => {
  const plan = buildTier1Command({
    scrubRoot: "/run/lxp/preview/w1/root",
    nodePathInRoot: "/node",
    childPathInRoot: "/child.mjs",
  });

  it("wraps with setpriv no-new-privs and empty inheritable+bounding cap sets", () => {
    expect(plan.file).toBe("setpriv");
    expect(plan.argv).toContain("--no-new-privs");
    expect(plan.argv).toContain("--inh-caps=-all");
    expect(plan.argv).toContain("--bounding-set=-all");
  });

  it("unshares user/net/pid/mount/uts/ipc and chroots via --root", () => {
    expect(plan.argv).toContain("unshare");
    expect(plan.argv).toContain("--user");
    expect(plan.argv).toContain("--map-root-user"); // implies --setgroups=deny
    expect(plan.argv).toContain("--net"); // empty netns ⇒ ENETUNREACH
    expect(plan.argv).toContain("--mount-proc");
    expect(plan.argv).toContain("--kill-child"); // dies with the panel
    expect(plan.argv).toContain("--root=/run/lxp/preview/w1/root");
  });

  it("execs node+child as the final argv tail", () => {
    expect(plan.argv.slice(-2)).toEqual(["/node", "/child.mjs"]);
  });

  it("passes a minimal env with NO panel secrets", () => {
    expect(Object.keys(plan.env).sort()).toEqual(["LXP_PREVIEW_SANDBOX", "NODE_OPTIONS", "PATH"]);
    expect(plan.env.PATH).toBe("/usr/bin:/bin");
    expect(plan.env.NODE_OPTIONS).toContain("--disallow-code-generation-from-strings");
    // sanity: no obvious secret-ish keys leaked in
    for (const k of Object.keys(plan.env)) {
      expect(k).not.toMatch(/KEY|PEM|SECRET|TOKEN|LUXIPANEL/i);
    }
  });
});

describe("preview-sandbox substrate probe", () => {
  it("returns a coherent structural probe (never throws)", () => {
    const p = probeSubstrate();
    expect([0, 1, 2]).toContain(p.tier);
    expect(typeof p.reason).toBe("string");
    // tier>=1 must imply the confining primitives are reported present
    if (p.tier >= 1) {
      expect(p.confining).toBe(true);
      expect(p.detail.unshare).toBe(true);
      expect(p.detail.setpriv).toBe(true);
      expect(p.detail.userns).toBe(true);
    } else {
      expect(p.confining).toBe(false);
    }
  });
});

describe("preview-sandbox substrate Tier-2 command builder", () => {
  const spec: Tier2Spec = {
    scrubRoot: "/run/lxp/preview/w1/root",
    nodePathInRoot: "/node",
    childPathInRoot: "/child.mjs",
    unitName: `${PIPS_UNIT_PREFIX}w1-abc`,
  };
  const plan = buildTier2Command(spec);

  it("invokes systemd-run --user with a collected exec service unit", () => {
    expect(plan.file).toBe("systemd-run");
    expect(plan.argv).toContain("--user");
    expect(plan.argv).toContain("--service-type=exec");
    expect(plan.argv).toContain("--collect");
    expect(plan.argv).toContain(`--unit=${PIPS_UNIT_PREFIX}w1-abc`);
  });

  it("carries the §3.2 cgroup/seccomp hardening property set (audit-ready -p pairs)", () => {
    const props = plan.argv;
    // each property must be preceded by a `-p` flag → grab the values.
    const values: string[] = [];
    for (let i = 0; i < props.length - 1; i++) {
      if (props[i] === "-p") values.push(props[i + 1]!);
    }
    expect(values).toContain("MemoryMax=128M");
    expect(values).toContain("MemorySwapMax=0");
    expect(values).toContain("TasksMax=32");
    expect(values).toContain("CPUQuota=50%");
    expect(values).toContain("NoNewPrivileges=yes");
    expect(values).toContain("CapabilityBoundingSet=");
    expect(values).toContain("RestrictAddressFamilies=AF_UNIX");
    expect(values).toContain("SystemCallFilter=@system-service");
    // blocked syscalls return EPERM, NOT SIGSYS (graceful JS error)
    expect(values).toContain("SystemCallErrorNumber=EPERM");
    expect(values).toContain(`InaccessiblePaths=${panelConfigDir()}:/etc/nginx/certs`);
    expect(values).toContain("ProtectProc=invisible");
    expect(values).toContain("ProcSubset=pid");
    // a second SystemCallFilter denylist is present (repeated key)
    expect(values.some((v) => v.startsWith("SystemCallFilter=~@privileged"))).toBe(true);
  });

  it("DROPS DynamicUser and never sets PrivateNetwork (silent no-op trap)", () => {
    for (const a of plan.argv) {
      expect(a).not.toMatch(/DynamicUser/);
      expect(a).not.toMatch(/PrivateNetwork/);
    }
  });

  it("wraps the EXACT Tier-1 inner command as the argv tail", () => {
    const inner = buildTier1Command(spec); // file=setpriv, argv contains its own `--`s
    // The systemd-run boundary is the `--` immediately followed by inner.file.
    let bound = -1;
    for (let i = 0; i < plan.argv.length - 1; i++) {
      if (plan.argv[i] === "--" && plan.argv[i + 1] === inner.file) {
        bound = i;
        break;
      }
    }
    expect(bound).toBeGreaterThan(0);
    const tail = plan.argv.slice(bound + 1);
    expect(tail[0]).toBe(inner.file); // setpriv
    expect(tail.slice(1)).toEqual(inner.argv);
    // and the node+child are still the final argv tail
    expect(tail.slice(-2)).toEqual(["/node", "/child.mjs"]);
  });

  it("propagates ONLY the minimal Tier-1 env via --setenv (no panel secrets)", () => {
    const setenvs: string[] = [];
    for (let i = 0; i < plan.argv.length - 1; i++) {
      if (plan.argv[i] === "--setenv") setenvs.push(plan.argv[i + 1]!);
    }
    expect(setenvs.some((v) => v.startsWith("PATH="))).toBe(true);
    expect(setenvs.some((v) => v.startsWith("LXP_PREVIEW_SANDBOX="))).toBe(true);
    for (const v of setenvs) {
      expect(v).not.toMatch(/KEY|PEM|SECRET|TOKEN|LUXIPANEL/i);
    }
  });

  it("tier2PropertySet emits well-formed -p pairs and drops DynamicUser", () => {
    const set = tier2PropertySet(spec);
    // even length: always -p <value> pairs
    expect(set.length % 2).toBe(0);
    for (let i = 0; i < set.length; i += 2) {
      expect(set[i]).toBe("-p");
      expect(set[i + 1]).toMatch(/=.*/);
    }
    expect(set.join(" ")).not.toMatch(/DynamicUser/);
  });
});

describe("preview-sandbox Tier-2 probe + orphan reap (never throw)", () => {
  it("probeTier2 never throws and rejects when the user bus is absent", () => {
    const p = probeTier2();
    expect(typeof p.reachable).toBe("boolean");
    expect(typeof p.confining).toBe("boolean");
    expect(typeof p.reason).toBe("string");
    // confining can only be true if reachable
    if (p.confining) expect(p.reachable).toBe(true);
  });

  it("reapOrphans resolves without throwing (idempotent best-effort)", async () => {
    await expect(reapOrphans()).resolves.toBeUndefined();
  });

  it("pdeathsigSetprivFlags requests SIGKILL on parent death", () => {
    expect(pdeathsigSetprivFlags()).toContain("--pdeathsig=SIGKILL");
  });
});
