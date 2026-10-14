// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Pre-save validation (#7).
 *
 * Validates editor content before it's written so a bad edit doesn't break a
 * site. Cheap/static checks (JSON, .env, brace balance) run in-process; the
 * ones that need a real parser (PHP `php -l`, YAML via python) run on the
 * client server through the executor, writing the content to a throwaway tmp
 * file. If the required tool isn't installed the check is reported as
 * `skipped: true` (never blocks the save).
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";

export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
}

export interface ValidationResult {
  validator: string;
  valid: boolean;
  errors: ValidationError[];
  /** True when the relevant tool was unavailable — content was NOT validated. */
  skipped?: boolean;
}

const VALIDATE_TIMEOUT_MS = 12_000;

async function hasCommand(executor: Executor, cmd: string): Promise<boolean> {
  try {
    const r = await executor.exec(`command -v ${cmd}`);
    return r.exitCode === 0 && r.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Convert a 0-based string offset to 1-based line/column. */
function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") { line++; column = 1; } else { column++; }
  }
  return { line, column };
}

/** Pick the validator id for a file from its name/extension. */
export function validatorFor(filePath: string): string {
  const name = path.posix.basename(filePath).toLowerCase();
  if (name === ".env" || name.startsWith(".env.")) return "env";
  if (name === ".htaccess") return "braces";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  switch (ext) {
    case "json": return "json";
    case "php": case "phtml": return "php";
    case "yaml": case "yml": return "yaml";
    case "conf": case "nginx": return "nginx";
    default: return "none";
  }
}

function validateJson(content: string): ValidationResult {
  try {
    JSON.parse(content);
    return { validator: "json", valid: true, errors: [] };
  } catch (err) {
    const msg = (err as Error).message;
    const m = msg.match(/position (\d+)/);
    const location = msg.match(/line (\d+) column (\d+)/i);
    const errors: ValidationError[] = [];
    if (m) {
      const { line, column } = offsetToLineCol(content, Number(m[1]));
      errors.push({ line, column, message: "JSON no válido" });
    } else if (location) {
      errors.push({ line: Number(location[1]), column: Number(location[2]), message: "JSON no válido" });
    } else {
      errors.push({ message: "JSON no válido" });
    }
    return { validator: "json", valid: false, errors };
  }
}

function validateEnv(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    // KEY=VALUE — key must be a valid identifier.
    if (!/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) {
      errors.push({ line: i + 1, message: `Línea no válida (se esperaba CLAVE=valor): "${raw.slice(0, 60)}"` });
    }
  });
  return { validator: "env", valid: errors.length === 0, errors };
}

/** Balanced-braces heuristic for nginx/.htaccess style configs. */
function validateBraces(content: string, validator: string): ValidationResult {
  let depth = 0;
  let lineNo = 1;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === "\n") lineNo++;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) {
        return { validator, valid: false, errors: [{ line: lineNo, message: "Llave de cierre «}» sin apertura correspondiente." }] };
      }
    }
  }
  if (depth !== 0) {
    return { validator, valid: false, errors: [{ message: `Faltan ${depth} llave(s) de cierre «}».` }] };
  }
  return { validator, valid: true, errors: [] };
}

/** Run a validator command against the content staged in a tmp file. */
async function validateViaTmp(
  executor: Executor,
  validator: string,
  content: string,
  ext: string,
  buildCmd: (tmp: string) => string,
  parse: (out: { stdout: string; stderr: string; exitCode: number }, tmp: string) => ValidationError[],
): Promise<ValidationResult> {
  const tmp = `/tmp/lxp-validate-${randomUUID()}.${ext}`;
  try {
    await executor.writeFile(tmp, content, { encoding: "utf-8" });
    const out = await executor.exec(buildCmd(tmp), { timeoutMs: VALIDATE_TIMEOUT_MS });
    const errors = parse(out, tmp);
    return { validator, valid: errors.length === 0, errors };
  } finally {
    try { await executor.exec(quoteCmd("rm", ["-f", tmp])); } catch { /* best effort */ }
  }
}

export const validationService = {
  /** Validate content for `path`. Never throws; unknown types → valid. */
  async validate(executor: Executor, filePath: string, content: string): Promise<ValidationResult> {
    const validator = validatorFor(filePath);
    switch (validator) {
      case "json":
        return validateJson(content);
      case "env":
        return validateEnv(content);
      case "nginx":
      case "braces":
        return validateBraces(content, validator);
      case "php": {
        if (!(await hasCommand(executor, "php"))) return { validator: "php", valid: true, errors: [], skipped: true };
        return validateViaTmp(executor, "php", content, "php",
          (tmp) => quoteCmd("php", ["-l", tmp]),
          (out, tmp) => {
            if (out.exitCode === 0) return [];
            const text = `${out.stderr}\n${out.stdout}`;
            const m = text.match(/(?:Parse|Fatal) error:\s*(.+?)\s+in\s+\S+\s+on line\s+(\d+)/i);
            if (m) return [{ line: Number(m[2]), message: m[1]!.trim() }];
            return [{ message: text.replace(new RegExp(tmp, "g"), path.posix.basename(filePath)).trim().slice(0, 300) || "Error de sintaxis PHP" }];
          });
      }
      case "yaml": {
        if (!(await hasCommand(executor, "python3"))) return { validator: "yaml", valid: true, errors: [], skipped: true };
        return validateViaTmp(executor, "yaml", content, "yaml",
          (tmp) => `python3 -c 'import sys,yaml; yaml.safe_load(open(sys.argv[1]))' ${quoteArg(tmp)} 2>&1`,
          (out) => {
            if (out.exitCode === 0) return [];
            const text = `${out.stdout}\n${out.stderr}`;
            if (/No module named ['"]?yaml/.test(text)) return []; // pyyaml missing → can't validate
            const m = text.match(/line (\d+), column (\d+)/i);
            if (m) return [{ line: Number(m[1]), column: Number(m[2]), message: "YAML no válido" }];
            return [{ message: text.trim().slice(0, 300) || "YAML no válido" }];
          });
      }
      default:
        return { validator: "none", valid: true, errors: [] };
    }
  },
};
