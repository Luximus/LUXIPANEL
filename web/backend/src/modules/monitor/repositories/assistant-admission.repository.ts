// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { CONFIG_DIR } from "../../../config/paths.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { assistantAdmissionSchema, DEFAULT_ASSISTANT_ADMISSION, type AssistantAdmissionConfig } from "../models/assistant-admission.model.js";

// Publicly readable numeric policy: the CLI runs as the connected Linux user,
// which may differ from the account that saved Monitor's setting.
const directory = posix.join(CONFIG_DIR, "monitor");
const file = posix.join(directory, "assistant-admission.json");

export const assistantAdmissionRepository = {
  async load(executor: Executor): Promise<AssistantAdmissionConfig> {
    try {
      const raw = await executor.readFile(file, "utf-8");
      return assistantAdmissionSchema.parse(JSON.parse(String(raw)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || /no such file/i.test(String(error))) {
        return { ...DEFAULT_ASSISTANT_ADMISSION };
      }
      throw error;
    }
  },
  async save(executor: Executor, config: AssistantAdmissionConfig): Promise<void> {
    const checked = assistantAdmissionSchema.parse(config);
    let created = await executor.exec(`mkdir -p -- ${quoteArg(directory)}`);
    if (created.exitCode !== 0) created = await executor.exec(`sudo -A install -d -m 0755 -- ${quoteArg(directory)}`);
    if (created.exitCode !== 0) throw new Error("No se pudo preparar la configuración de admisión del servidor");
    const temp = `${file}.tmp-${randomUUID()}`;
    try {
      const payload = `${JSON.stringify(checked)}\n`;
      try {
        await executor.writeFile(temp, payload, { encoding: "utf-8", mode: 0o644 });
      } catch {
        const encoded = Buffer.from(payload, "utf-8").toString("base64");
        const write = await executor.exec(`printf '%s' ${quoteArg(encoded)} | base64 -d | sudo -A tee ${quoteArg(temp)} >/dev/null`);
        if (write.exitCode !== 0) throw new Error("No se pudo guardar la política de admisión en el servidor");
      }
      let permissions = await executor.exec(`chmod 0644 -- ${quoteArg(temp)}`);
      if (permissions.exitCode !== 0) permissions = await executor.exec(`sudo -A chmod 0644 -- ${quoteArg(temp)}`);
      if (permissions.exitCode !== 0) throw new Error("No se pudieron aplicar los permisos de la política de admisión");
      try {
        await executor.rename(temp, file);
      } catch {
        // A lost response can mean rename already happened. Read state before retrying.
        const current = await assistantAdmissionRepository.load(executor);
        if (current.memPercent === checked.memPercent) return;
        const renamed = await executor.exec(`sudo -A mv -f -- ${quoteArg(temp)} ${quoteArg(file)}`);
        if (renamed.exitCode !== 0) throw new Error("No se pudo activar la política de admisión en el servidor");
      }
    } catch (error) {
      await executor.unlink(temp).catch(async () => { await executor.exec(`sudo -A rm -f -- ${quoteArg(temp)}`).catch(() => undefined); });
      throw error;
    }
  },
};
