// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { normalizeRegistrationResponse } from "./passkey-registration.js";

describe("normalizeRegistrationResponse", () => {
  it("accepts legacy payloads with top-level credential fields", () => {
    const credential = normalizeRegistrationResponse({
      label: "My passkey",
      id: "cred-1",
      rawId: "raw-1",
      type: "public-key",
      response: {
        clientDataJSON: "client-data",
        attestationObject: "attestation-data",
      },
    });

    expect(credential.id).toBe("cred-1");
    expect(credential.rawId).toBe("raw-1");
    expect(credential.type).toBe("public-key");
    expect(credential.response.clientDataJSON).toBe("client-data");
    expect(credential.response.attestationObject).toBe("attestation-data");
  });

  it("accepts wrapped payloads with the full credential under response", () => {
    const credential = normalizeRegistrationResponse({
      label: "My passkey",
      response: {
        id: "cred-2",
        rawId: "raw-2",
        type: "public-key",
        response: {
          clientDataJSON: "client-data-2",
          attestationObject: "attestation-data-2",
        },
      },
    });

    expect(credential.id).toBe("cred-2");
    expect(credential.rawId).toBe("raw-2");
    expect(credential.response.clientDataJSON).toBe("client-data-2");
    expect(credential.response.attestationObject).toBe("attestation-data-2");
  });
});
