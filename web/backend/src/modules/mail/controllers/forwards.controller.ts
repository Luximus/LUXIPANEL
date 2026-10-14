// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Forwards controller — manage per-account email forwards.
 *
 * Source of truth on this fleet is the Postfix `virtual_alias_maps` file
 * (`/etc/postfix/virtual`, the path `mailConfig.postfix.vmailbox` resolves to
 * by replacing "vmailbox" → "virtual" — same file the manual aliases and the
 * panel catch-all use). Forwards are stored as one line per source address:
 *
 *   user@dom.com    dest1@x.com, dest2@y.com[, user@dom.com]
 *
 * The trailing `user@dom.com` (the source itself) means "keep a local copy".
 * Reads mirror the operator's awk; writes preserve every other line verbatim
 * (other accounts, comments, blanks) and run `postmap` so Postfix picks the
 * change up immediately. The previous sidecar+Sieve model is not used here:
 * this server's forwards live in Postfix, not in per-account JSON.
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { mailConfig } from "../../../config/mail.js";
import { emailSchema } from "../../../shared/validators/index.js";
import { NotFoundError } from "../../../shared/errors/index.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { fnv1aId } from "./accounts.helpers.js";
import { resolveOwnedAccountAddress as resolveAddress } from "./mailbox-account.helpers.js";
import { injectSudoIntoShellScript } from "../../../shared/system/sudo-runtime.js";

const replaceForwardsSchema = z.object({
  forwards: z.array(z.object({
    destination: emailSchema,
    keepCopy: z.boolean().default(true),
  })),
});

function virtualPath(): string {
  return mailConfig.postfix.virtual;
}

async function readVirtual(executor: Executor): Promise<string> {
  const p = virtualPath();
  try {
    const data = await executor.readFile(p, "utf-8");
    return typeof data === "string" ? data : data.toString("utf-8");
  } catch {
    try {
      const out = await executor.exec(quoteCmd("sudo", ["cat", p]));
      return out.exitCode === 0 ? out.stdout : "";
    } catch {
      return "";
    }
  }
}

/** Forwards for `address` parsed from the virtual map (mirrors the awk). */
function parseForwardsFor(content: string, address: string): { destinations: string[]; keepCopy: boolean } {
  const destinations: string[] = [];
  let keepCopy = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [src, ...rest] = line.split(/\s+/);
    if (!src || rest.length === 0) continue;
    if (src.trim().toLowerCase() !== address) continue;
    for (const d of rest.join(" ").split(",").map((x) => x.trim()).filter(Boolean)) {
      if (d.toLowerCase() === address) { keepCopy = true; continue; }
      if (!destinations.includes(d)) destinations.push(d);
    }
  }
  return { destinations, keepCopy };
}

/**
 * Rebuild the virtual map: keep every line that is NOT a source-alias for
 * `address` exactly as-is (other accounts, comments, blank lines), then append
 * a single line for `address` if it has forwards.
 */
function rebuildVirtual(
  content: string,
  address: string,
  forwards: Array<{ destination: string; keepCopy: boolean }>,
): string {
  const kept: string[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) { kept.push(raw); continue; }
    const src = line.split(/\s+/)[0] ?? "";
    if (src.trim().toLowerCase() === address) continue; // drop old alias lines for this address
    kept.push(raw);
  }
  while (kept.length && kept[kept.length - 1]!.trim() === "") kept.pop();

  const dests = forwards.map((f) => f.destination.trim()).filter(Boolean);
  if (dests.length > 0) {
    const keepCopy = forwards.some((f) => f.keepCopy);
    const finalDests = keepCopy ? [...dests, address] : dests;
    kept.push(`${address}\t${finalDests.join(", ")}`);
  }
  return kept.join("\n") + "\n";
}

async function writeVirtual(executor: Executor, content: string): Promise<void> {
  const p = virtualPath();
  try {
    await executor.writeFile(p, content, { encoding: "utf-8" });
  } catch {
    const marker = `__LXP_VIRTUAL_${randomUUID().replace(/-/g, "_")}__`;
    const body = await injectSudoIntoShellScript(
      executor,
      [
        // Unguessable staging name (audit §5): a predictable path let a local
        // user pre-plant a symlink before the `sudo cp`. `umask 077` keeps the
        // heredoc file 0600.
        `tmp="/tmp/luxipanel-postfix-virtual-${randomUUID()}"`,
        "umask 077",
        `cat > "$tmp" <<'${marker}'`,
        content.replace(/\r/g, ""),
        marker,
        `sudo cp "$tmp" ${quoteArg(p)}`,
        `sudo chmod 644 ${quoteArg(p)}`,
        "rm -f \"$tmp\"",
      ].join("\n"),
    );
    const copy = await executor.exec(`sh -lc ${quoteArg(body)}`);
    if (copy.exitCode !== 0) {
      throw new Error(`sudo cp -> ${p} failed: ${(copy.stderr || copy.stdout || "").trim() || "exit " + copy.exitCode}`);
    }
  }
  await executor.exec(quoteCmd("sudo", ["postmap", p]));
}

function toForwardItems(address: string, destinations: string[], keepCopy: boolean) {
  return destinations.map((destination) => ({
    id: fnv1aId(`${address}->${destination}`),
    destination,
    keepCopy,
    enabled: true,
  }));
}

export const forwardsController = {
  /** GET /api/accounts/:accountId/forwards — read from Postfix virtual map. */
  list: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const executor = getExecutor(req);
    const { destinations, keepCopy } = parseForwardsFor(await readVirtual(executor), address);
    res.json({ ok: true, data: toForwardItems(address, destinations, keepCopy) });
  }),

  /** PUT /api/accounts/:accountId/forwards — replace all (rewrites the line). */
  replace: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const body = replaceForwardsSchema.parse(req.body);
    const executor = getExecutor(req);

    const content = await readVirtual(executor);
    await writeVirtual(executor, rebuildVirtual(content, address, body.forwards));
    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });

    const { destinations, keepCopy } = parseForwardsFor(await readVirtual(executor), address);
    res.json({ ok: true, data: toForwardItems(address, destinations, keepCopy) });
  }),

  /** DELETE /api/accounts/:accountId/forwards/:forwardId. */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const address = await resolveAddress(req);
    const forwardId = Number.parseInt(String(req.params["forwardId"]), 10);
    const executor = getExecutor(req);

    const content = await readVirtual(executor);
    const { destinations, keepCopy } = parseForwardsFor(content, address);
    const remaining = destinations
      .filter((d) => fnv1aId(`${address}->${d}`) !== forwardId)
      .map((destination) => ({ destination, keepCopy }));
    if (remaining.length === destinations.length) throw new NotFoundError("Forward");

    await writeVirtual(executor, rebuildVirtual(content, address, remaining));
    eventBus.emit(Events.ACCOUNT_UPDATED, { accountId: fnv1aId(address) });
    res.json({ ok: true });
  }),
};
