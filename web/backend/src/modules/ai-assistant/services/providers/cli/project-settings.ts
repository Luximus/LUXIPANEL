// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { quoteArg, type Executor } from "../../../../../shared/executor/index.js";
import { panelConfigDir } from "../../../../../config/paths.js";
import { ValidationError } from "../../../../../shared/errors/index.js";

/** Load persisted native settings without moving cwd or sharing conversation homes. */
export async function readProjectSettings(executor: Executor, root?: string): Promise<Record<string, any>> {
  if (!root) return {};
  if (!root.startsWith(`${panelConfigDir()}/assistant/projects/`) || !/^[a-zA-Z0-9_-]+$/.test(root.split("/").at(-1)!)) throw new ValidationError("Ruta de configuración inválida.");
  const script = String.raw`
import json,sys,os,tomllib
root=sys.argv[1]
if os.path.realpath(root)!=root: raise Exception('Unsafe settings directory')
if not os.path.isfile(root+'/storage.json'): print('{}'); sys.exit(0)
def read(rel,toml=False):
 path=os.path.realpath(root+'/'+rel)
 if not path.startswith(root+'/'): raise Exception('Unsafe settings file')
 try:
  with open(path,'rb') as f: data=f.read(524289)
 except FileNotFoundError: return {}
 if len(data)>524288: raise Exception('Settings too large')
 return tomllib.loads(data.decode()) if toml else json.loads(data)
claude=read('.claude/settings.json'); claude.update(read('.claude/settings.local.json'))
print(json.dumps({'claude':claude,'codex':read('.codex/config.toml',True),'gemini':read('.gemini/settings.json')}))
`;
  const r = await executor.exec(`python3 -c ${quoteArg(script)} ${quoteArg(root)}`, { timeoutMs: 10000 });
  if (r.exitCode !== 0) throw new ValidationError("No se pudo cargar la configuración permanente del proveedor. Revisa sus archivos en Estructura.");
  return JSON.parse(r.stdout);
}

/** Config overrides use dotted keys; never replace the scoped MCP channels or
 * the panel's approval/sandbox policy with persisted project preferences. */
export function codexProjectOverrides(settings: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const denied = /^(approval_policy|sandbox_mode|sandbox_permissions|permissions|sandbox_workspace_write|mcp_servers\.(codebase[-_]?(memory|graph)|luxipanel(?:[-_](?:modules|servers))?)(\.|$))/;
  const walk = (value: any, key: string) => {
    if (denied.test(key)) return;
    if (value && typeof value === "object" && !Array.isArray(value)) for (const [k, v] of Object.entries(value)) walk(v, key ? `${key}.${k}` : k);
    else if (key) out[key] = value;
  };
  walk(settings, "");
  return out;
}
