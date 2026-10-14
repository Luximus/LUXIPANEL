// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Request ID middleware — assigns a unique UUID to every incoming request
 * and sets the X-Request-Id response header.
 */

import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";

/** Client-supplied ids are echoed into a response header and every log line, so
 *  they must be a short, safe token. Control chars would make `res.setHeader`
 *  throw ERR_INVALID_CHAR (500); an overlong value bloats logs/audit. Anything
 *  that doesn't match is replaced with a fresh UUID. */
const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const header = req.headers["x-request-id"];
  const id =
    typeof header === "string" && REQUEST_ID_RE.test(header) ? header : randomUUID();

  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
};
