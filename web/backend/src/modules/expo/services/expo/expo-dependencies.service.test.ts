// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/system/sudo-runtime.js", () => ({
  injectSudoIntoShellScript: vi.fn(async (_executor: unknown, body: string) => body),
}));

import type { Executor } from "../../../../shared/executor/index.js";
import { expoDependenciesService } from "./expo-dependencies.service.js";

describe("Expo project dependency installation", () => {
  it("runs only for a detected project on the connected executor and verifies completion", async () => {
    const commands: string[] = [];
    const executor = {
      exec: vi.fn(async (cmd: string) => {
        commands.push(cmd);
        if (cmd.includes("<<APPJSON>>")) return { stdout: '<<APPJSON>>\n{}\n<<PKGJSON>>\n{"dependencies":{"expo":"~54.0.0"}}\n<<RUNTIME>>\n00<<END>>\n', stderr: "", exitCode: 0 };
        if (cmd.includes("systemctl is-active")) return { stdout: "inactive", stderr: "", exitCode: 3 };
        if (cmd.includes("id -un")) return { stdout: "tester\n/home/tester", stderr: "", exitCode: 0 };
        if (cmd.includes("tail -c 6000")) return { stdout: "installed\n__LXP_INSTALL_EXIT__:0", stderr: "", exitCode: 0 };
        if (cmd.includes("node -e")) return { stdout: "11", stderr: "", exitCode: 0 };
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
    } as unknown as Executor;

    const started = await expoDependenciesService.install(executor, "/srv/my-app");
    expect(started.status).toBe("running");
    expect(commands.some((cmd) => cmd.includes("systemd-run") && cmd.includes("--working-directory=") && cmd.includes("/srv/my-app"))).toBe(true);

    const completed = await expoDependenciesService.status(executor, "/srv/my-app");
    expect(completed.ok).toBe(true);
    expect(completed.status).toBe("done");
  });
});
