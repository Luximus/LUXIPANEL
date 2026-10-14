// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * API proxy — forwards all /api/* requests to the backend in both
 * development and production. This avoids noisy Vite proxy errors and
 * gives the frontend a consistent failure mode when the backend is down.
 */

import type { APIRoute } from "astro";
import { getBackendUrl, getUploadMaxBytes } from "@/lib/server-env";

// process.env is resolved at runtime; import.meta.env is baked at build time
// and would be undefined when BACKEND_URL is not set during `npm run build`.
const BACKEND_URL = getBackendUrl();

// SECURITY/STABILITY: cap forwarded body size so a malicious or buggy
// client cannot exhaust the SSR worker's memory by streaming a huge payload
// (file uploads are gated by per-route handlers upstream; this is a hard
// outer cap on the proxy). Kept in sync with the backend upload limit
// (FILES_UPLOAD_MAX_BYTES, config/env.ts) so the proxy is NOT the bottleneck
// for large uploads; read at runtime with a 512 MiB default (see server-env).
const MAX_BODY_BYTES = getUploadMaxBytes();
// Per-request backend timeout. Without it, a hung backend holds the SSR
// worker slot open indefinitely — resource exhaustion vector.
const BACKEND_TIMEOUT_MS = 30_000;
// Uploads (multipart/form-data or the raw octet-stream path used by
// `uploadFile`) legitimately take far longer than a normal API call: a large
// file over a slow SFTP link can run for minutes. Applying the 30s cap to them
// aborted big uploads mid-transfer and the edge turned the truncated upstream
// reply into a 504. Uploads therefore get a much larger bound (still finite so
// a genuinely hung backend cannot pin the worker forever); normal requests keep
// the tight 30s timeout.
const UPLOAD_TIMEOUT_MS = 10 * 60_000;
// Detect a body-carrying upload by content-type. `multipart/form-data` covers
// form uploads; `application/octet-stream` covers the panel's raw binary upload
// helper (`api-client.uploadFile`, which also sets `X-Filename`).
const isUpload = (request: Request): boolean => {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  return ct.includes("multipart/form-data") || ct.includes("application/octet-stream") || request.headers.has("x-filename");
};

// SSE endpoints (chat feed, assistant run stream) are long-lived by design:
// the response body keeps trickling for minutes. `AbortSignal.timeout` bounds
// the WHOLE fetch in undici — body included — so a streaming response got
// aborted mid-flight at 30s and the edge turned the truncated upstream reply
// into a 502 (`GET /api/chat/stream 502`). Streaming requests therefore run
// WITHOUT the timeout; they are cheap (no buffering) and end when the client
// disconnects.
const isEventStream = (request: Request): boolean =>
  (request.headers.get("accept") || "").toLowerCase().includes("text/event-stream");

// Headers that must not be forwarded upstream (would cause conflicts)
// "accept-encoding" is stripped so the backend returns plain (uncompressed) responses —
// the proxy cannot stream pre-compressed bytes and set content-encoding correctly.
const HOP_BY_HOP_REQUEST = ["host", "connection", "keep-alive", "upgrade", "proxy-authorization", "accept-encoding"];
// Headers that must not be forwarded downstream (Node fetch sets its own)
const HOP_BY_HOP_RESPONSE = ["transfer-encoding", "connection", "keep-alive", "upgrade", "content-encoding"];

export const ALL: APIRoute = async ({ request, params }) => {
  const path = params.path ?? "";
  const url = new URL(request.url);
  const target = `${BACKEND_URL}/api/${path}${url.search}`;

  // Forward request headers, stripping hop-by-hop headers
  const reqHeaders = new Headers(request.headers);
  for (const h of HOP_BY_HOP_REQUEST) reqHeaders.delete(h);

  // Set the ORIGINAL public host/proto so the backend can build absolute links
  // for THIS panel's subdomain (e.g. cron approval URLs).
  // SECURITY: these are derived from the request URL Astro actually received and
  // are set UNCONDITIONALLY — a client-supplied `x-forwarded-host`/`-proto` must
  // never survive to poison the host of backend-generated absolute links.
  reqHeaders.set("x-forwarded-host", url.host);
  reqHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));
  // SSE: undici añade `accept-encoding: gzip, deflate, br` por su cuenta cuando
  // no viene ninguno; el backend comprimía el stream y su `compression` lo
  // retenía → el EventSource nunca recibía cabeceras. Forzar identity.
  if (isEventStream(request)) reqHeaders.set("accept-encoding", "identity");

  // Read body as ArrayBuffer — avoids Node.js ReadableStream duplex issues.
  // Works for JSON, octet-stream and multipart/form-data (preserves raw bytes +
  // boundary). NOTE (perf/OOM): this buffers the whole body (up to the 512 MiB
  // cap) in the SSR worker. Streaming it (duplex:"half") was tried but the real
  // backend, when it rejects an upload EARLY (auth/permission/validation/413)
  // without draining the body, resets the upstream connection → undici throws on
  // the half-written stream → the proxy masked the real status as an opaque 503.
  // Buffering relays the true status. If the OOM headroom becomes a problem,
  // lower FILES_UPLOAD_MAX_BYTES rather than reintroducing naive streaming.
  const hasBody = !["GET", "HEAD"].includes(request.method);
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    // Cap the body size BEFORE forwarding — protects the SSR worker from
    // memory exhaustion if the client streams a large payload.
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ ok: false, error: "Payload too large" }),
        { status: 413, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
      );
    }
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ ok: false, error: "Payload too large" }),
        { status: 413, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
      );
    }
  }

  const streaming = isEventStream(request);
  // Timeout selection: SSE gets none (long-lived body), uploads get the large
  // bound, everything else keeps the tight default.
  const timeoutMs = streaming ? 0 : (isUpload(request) ? UPLOAD_TIMEOUT_MS : BACKEND_TIMEOUT_MS);

  let backendRes: Response;
  try {
    backendRes = await fetch(target, {
      method: request.method,
      headers: reqHeaders,
      body: body !== undefined && body.byteLength > 0 ? body : undefined,
      // Bound the proxy request to avoid hanging the SSR worker on a slow /
      // unresponsive backend. SSE is exempt (see isEventStream): its body is
      // meant to stay open and the timeout would abort it into a 502. Uploads
      // (isUpload) use a much larger bound so big transfers are not aborted at
      // 30s into a 504.
      ...(timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const aborted = error instanceof Error && /aborted|abort|timeout/i.test(error.message);
    const status = aborted ? 504 : 503;
    return new Response(
      JSON.stringify({
        ok: false,
        error: aborted ? "Backend timeout" : "Backend unavailable",
        ...(import.meta.env.DEV ? { details } : {}),
      }),
      {
        status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  // Forward response headers, stripping hop-by-hop headers
  const resHeaders = new Headers(backendRes.headers);
  for (const h of HOP_BY_HOP_RESPONSE) resHeaders.delete(h);
  // API responses are no-store by default. EXCEPTION: media bytes (image/video/
  // audio) are cached PRIVATELY in the browser so file thumbnails and the
  // preview modal don't re-download on every grid render / re-open. `private`
  // keeps it out of shared caches (the content is per-user/permission).
  const contentType = (backendRes.headers.get("content-type") || "").toLowerCase();
  if (backendRes.ok && /^(image|video|audio)\//.test(contentType)) {
    resHeaders.set("cache-control", "private, max-age=3600");
  } else {
    resHeaders.set("cache-control", "no-store");
  }

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: resHeaders,
  });
};
