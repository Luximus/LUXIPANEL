/**
 * Browser-side WebAuthn helpers (works in Electron's Chromium too).
 */
function b64uToBuffer(b64u: string): ArrayBuffer {
  const padded = b64u.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64u.length + ((4 - (b64u.length % 4)) % 4), "=");
  const bin = atob(padded);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function bufferToB64u(buf: ArrayBuffer | Uint8Array | null | undefined): string {
  if (!buf) return "";
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function startRegistration(options: any) {
  const publicKey = {
    ...options,
    challenge: b64uToBuffer(options.challenge),
    user: {
      ...options.user,
      id: b64uToBuffer(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((c: any) => ({ ...c, id: b64uToBuffer(c.id) })),
  } as PublicKeyCredentialCreationOptions;

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Registration cancelled");
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToB64u(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToB64u(response.clientDataJSON),
      attestationObject: bufferToB64u(response.attestationObject),
      transports: typeof response.getTransports === "function" ? response.getTransports() : undefined,
    },
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}

/**
 * Ejecuta la ceremonia de step-up por passkey y devuelve el `stepUpToken`.
 *
 * En el shell Electron (origen file:// / localhost) navigator.credentials.get()
 * no puede correr contra el rp.id del portal, así que delegamos toda la
 * ceremonia (options → get → verify) a la ventana puente https
 * (electronApi.stepUpPasskey), igual que el login por passkey. En dev/navegador
 * real corremos la ceremonia directa reusando startAuthentication + los
 * endpoints /portal/auth/step-up/passkey/*.
 */
export async function runStepUpPasskey(
  scope: string,
  token: string,
  lang = "es",
): Promise<{ stepUpToken: string; expiresAt: number }> {
  const bridge = window.electronApi?.stepUpPasskey;
  if (bridge) {
    const res = await bridge({ token, scope, lang });
    if (!res.ok || !res.stepUpToken) {
      if (res.cancelled) throw new Error("passkey_cancelled");
      throw new Error(res.error ?? "passkey_failed");
    }
    return { stepUpToken: res.stepUpToken, expiresAt: res.expiresAt ?? 0 };
  }
  // Fallback (dev en navegador real): ceremonia directa contra el origen actual.
  const { stepUpPasskeyOptions, stepUpPasskeyVerify } = await import("./client");
  const options = await stepUpPasskeyOptions(scope, token);
  const assertion = await startAuthentication(options);
  return await stepUpPasskeyVerify(scope, assertion, token);
}

export async function startAuthentication(options: any) {
  const publicKey = {
    ...options,
    challenge: b64uToBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((c: any) => ({ ...c, id: b64uToBuffer(c.id) })),
  } as PublicKeyCredentialRequestOptions;

  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Authentication cancelled");
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToB64u(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToB64u(response.clientDataJSON),
      authenticatorData: bufferToB64u(response.authenticatorData),
      signature: bufferToB64u(response.signature),
      userHandle: response.userHandle ? bufferToB64u(response.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}
