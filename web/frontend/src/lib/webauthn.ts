// SPDX-License-Identifier: AGPL-3.0-only
const encode = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
export const decodeWebAuthn = (value: string) =>
  Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (character) => character.charCodeAt(0),
  );
export function registrationOptions(
  options: any,
): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: decodeWebAuthn(options.challenge),
    user: { ...options.user, id: decodeWebAuthn(options.user.id) },
    excludeCredentials: (options.excludeCredentials ?? []).map(
      (credential: any) => ({
        ...credential,
        id: decodeWebAuthn(credential.id),
      }),
    ),
  };
}
export function serializeRegistrationCredential(
  credential: PublicKeyCredential,
): Record<string, unknown> {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: encode(response.clientDataJSON),
      attestationObject: encode(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  };
}
