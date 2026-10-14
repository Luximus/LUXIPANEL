import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { localExecutor, quoteArg } from "../../../shared/executor/index.js";
import { repairBridge } from "../../../shared/diagnostics/repair-bridge.js";
import { gitCredentialsService, gitCredentialsEnabled } from "./git-credentials.service.js";

/** Exact repo boundaries: a similarly named repository is never authorized. */
export function githubRouteAllowed(route: string, login?: string): boolean {
  if (route === "/user") return true;
  const repo = route.match(/^\/repos\/([A-Za-z0-9-]{1,39})\/LUXIPANEL(?:[/?]|$)/i);
  return Boolean(repo && (repo[1]?.toLowerCase() === "luxisoft" || (login && repo[1]?.toLowerCase() === login.toLowerCase())));
}

export function registerLogsGithub(): void {
  repairBridge.registerGithub({
    options: async () => {
      const credentials = gitCredentialsEnabled() ? (await gitCredentialsService.list(localExecutor)).filter((c) => c.type === "https" && c.host === "github.com").map((c) => ({ id: c.id, label: c.label })) : [];
      let authenticated = false;
      try { authenticated = (await localExecutor.exec("gh auth status --hostname github.com", { timeoutMs: 5000 })).exitCode === 0; } catch { /* optional CLI */ }
      return { credentials, authenticated };
    },
    withAuth: async (id, fn) => {
      let login: string | undefined;
      const validate = (route: string) => { if (!githubRouteAllowed(route, login)) throw new Error("Repositorio GitHub no permitido."); };
      const identity = (route: string, data: unknown) => {
        const user = data as { login?: string };
        if (route === "/user" && user.login && /^[A-Za-z0-9-]{1,39}$/.test(user.login)) login = user.login;
        return data;
      };
      if (!id) return fn({
        env: { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "credential.helper", GIT_CONFIG_VALUE_0: "!gh auth git-credential" },
        api: async (method, route, body) => {
          validate(route);
          const temp = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-gh-"));
          try {
            const file = path.join(temp, "body.json"); if (body !== undefined) await fs.writeFile(file, JSON.stringify(body), { mode: 0o600 });
            const result = await localExecutor.exec(`gh api --hostname github.com --method ${quoteArg(method)} ${quoteArg(route)}${body !== undefined ? ` --input ${quoteArg(file)}` : ""}`, { timeoutMs: 30_000 });
            if (result.exitCode !== 0) throw Object.assign(new Error("GitHub no pudo completar la operación. Comprueba credenciales, permisos y conectividad."), { status: Number((result.stderr + result.stdout).match(/(?:HTTP |status code )([0-9]{3})/)?.[1]) || undefined });
            return identity(route, JSON.parse(result.stdout));
          } finally { await fs.rm(temp, { recursive: true, force: true }); }
        },
      });
      const credential = await gitCredentialsService.getDecrypted(localExecutor, id);
      if (!credential || credential.cred.type !== "https" || credential.cred.host !== "github.com") throw new Error("La credencial debe ser HTTPS para github.com.");
      const temp = await fs.mkdtemp(path.join(os.tmpdir(), "lxp-git-auth-"));
      try {
        const secretFile = path.join(temp, "token"); const helper = path.join(temp, "askpass");
        await fs.writeFile(secretFile, credential.secret, { mode: 0o600 });
        await fs.writeFile(helper, `#!/bin/sh\ncase "$1" in *Username*) printf '%s' 'x-access-token';; *) cat ${quoteArg(secretFile)};; esac\n`, { mode: 0o700 });
        return await fn({ env: { GIT_ASKPASS: helper, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "credential.helper", GIT_CONFIG_VALUE_0: "" },
          api: async (method, route, body) => {
            validate(route);
            const response = await fetch(`https://api.github.com${route}`, { method, headers: { Authorization: `Bearer ${credential.secret}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
            if (!response.ok) throw Object.assign(new Error(`GitHub respondió ${response.status}. Comprueba los permisos de la credencial para contenido y Pull Requests.`), { status: response.status });
            return identity(route, await response.json());
          },
        });
      } finally { await fs.rm(temp, { recursive: true, force: true }); }
    },
  });
}
