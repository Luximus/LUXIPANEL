/**
 * Cloudflare SSL-mode suggestion — listens for SSL_ISSUED (emitted by the
 * nginx SSL bridge after a successful Let's Encrypt issuance) and, when the
 * issued domain belongs to a Cloudflare zone whose SSL mode is "flexible" or
 * "off", emits CLOUDFLARE_SSL_MODE_SUGGESTED so the notifications module can
 * nudge the admin towards Full (strict).
 *
 * COMPLETELY fail-safe by design:
 * - `eventBus.emit` is synchronous, so this handler runs inside the ALS
 *   context of the request that emitted SSL_ISSUED — the connected server's
 *   executor is still available to `settingsRepository` (token lookup).
 * - Any missing token / unreachable Cloudflare / no matching zone → silent
 *   return. The handler never throws into the emitter and NEVER logs the
 *   token (only error messages, at debug level).
 */

import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { cloudflareConfigService } from "./cloudflare-config.service.js";
import { cloudflareApiService } from "./cloudflare-api.service.js";

const log = createModuleLogger("cloudflare-ssl-suggestion");

let wired = false;

async function suggestForDomain(domain: string): Promise<void> {
  // Throws 409 when no token is configured → swallowed by the caller.
  const token = await cloudflareConfigService.getToken();
  const zones = await cloudflareApiService.listZones(token);

  // Zone whose name is a suffix of the issued domain (longest match wins).
  const zone = zones
    .filter((z) => domain === z.name || domain.endsWith(`.${z.name}`))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (!zone) return;

  const settings = await cloudflareApiService.getZoneSettings(token, zone.id);
  const currentMode = settings.ssl;
  if (currentMode !== "flexible" && currentMode !== "off") return;

  eventBus.emit(Events.CLOUDFLARE_SSL_MODE_SUGGESTED, {
    domain,
    zoneId: zone.id,
    zoneName: zone.name,
    currentMode,
  });
}

/** Idempotent wiring — called once from registerCloudflareModule(). */
export function wireCloudflareSslSuggestion(): void {
  if (wired) return;
  wired = true;

  eventBus.on(Events.SSL_ISSUED, (payload: unknown) => {
    try {
      const data = (payload as Record<string, unknown>) ?? {};
      const domain =
        typeof data.domain === "string" ? data.domain.trim().toLowerCase() : "";
      if (!domain) return;
      // Fire-and-forget: the SSL issuance flow must never wait on (or fail
      // because of) this best-effort suggestion.
      void suggestForDomain(domain).catch((err) => {
        log.debug(
          { domain, err: errMessage(err) },
          "Cloudflare SSL-mode suggestion skipped",
        );
      });
    } catch {
      // Never propagate into the SSL_ISSUED emitter.
    }
  });
}
