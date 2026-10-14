// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { AuthError } from "../../../shared/errors/index.js";

export type RegisterVerifyBody = {
  label?: string;
  response?: Record<string, unknown>;
  [key: string]: unknown;
};

export function normalizeRegistrationResponse(body: RegisterVerifyBody): RegistrationResponseJSON {
  const response = body.response;

  if (
    response &&
    typeof response === "object" &&
    "id" in response &&
    "rawId" in response &&
    "type" in response &&
    "response" in response
  ) {
    return response as unknown as RegistrationResponseJSON;
  }

  if (
    typeof body.id === "string" &&
    typeof body.rawId === "string" &&
    typeof body.type === "string" &&
    response &&
    typeof response === "object" &&
    "clientDataJSON" in response &&
    "attestationObject" in response
  ) {
    return body as unknown as RegistrationResponseJSON;
  }

  throw new AuthError("Invalid registration response");
}
