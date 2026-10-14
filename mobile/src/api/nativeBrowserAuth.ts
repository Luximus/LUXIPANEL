import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { normalizeBaseUrl, xhrRequest, extractCookie, type DirectSession } from "./directAuth";
export const NATIVE_CALLBACK = "luxipanel://auth/callback";
const b64url = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function verifyNativeCallback(callback: string, expectedState: string): string {
  const url = new URL(callback);
  const code = url.searchParams.get("code");
  if (url.protocol !== "luxipanel:" || url.username || url.password || url.port || url.hash || url.hostname !== "auth" || url.pathname !== "/callback" || url.searchParams.get("state") !== expectedState || !code || !/^[A-Za-z0-9_-]{43}$/.test(code) || url.searchParams.getAll("code").length !== 1 || url.searchParams.getAll("state").length !== 1) throw new Error("Respuesta de autenticación inválida.");
  return code;
}
export async function loginInSystemBrowser(baseUrl: string, language: string, current = () => true): Promise<DirectSession | null> {
  const base = normalizeBaseUrl(baseUrl);
  const state = b64url(await Crypto.getRandomBytesAsync(32));
  const verifier = b64url(await Crypto.getRandomBytesAsync(32));
  const challengeHex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
  const challenge = b64url(Uint8Array.from(challengeHex.match(/../g) ?? [], hex => parseInt(hex, 16)));
  const start = await xhrRequest("POST", `${base}/api/auth/native/start`, { body: { state, codeChallenge: challenge, codeChallengeMethod: "S256", language } });
  if (start.status === 404) throw new Error("Actualiza LUXIPANEL en este servidor para usar el acceso desde el navegador en la app.");
  const data = start.body.data as {authorizationUrl?:string} | undefined;
  if (start.status >= 400 || start.body.ok !== true || !data?.authorizationUrl || !current()) throw new Error("No se pudo iniciar el acceso seguro.");
  const authorize = new URL(data.authorizationUrl);
  if (authorize.origin !== base || authorize.pathname !== "/login" || !/^[A-Za-z0-9_-]{43}$/.test(authorize.searchParams.get("nativeRequest") ?? "")) throw new Error("Origen de autenticación inválido.");
  const result = await WebBrowser.openAuthSessionAsync(authorize.toString(), NATIVE_CALLBACK);
  if (!current() || result.type !== "success") return null;
  const code = verifyNativeCallback(result.url, state);
  const response = await xhrRequest("POST", `${base}/api/auth/native/redeem`, { body: { code, state, codeVerifier: verifier } });
  const session = response.body.data as {jwt?:string;expiresAt?:number} | undefined;
  const csrf = extractCookie(response.cookies, "luxipanel_csrf");
  if (!current()) return null;
  if (response.status >= 400 || response.body.ok !== true || !session?.jwt || !csrf) throw new Error("El acceso caducó. Inténtalo de nuevo.");
  return { jwt: session.jwt, csrf: {name:"luxipanel_csrf",value:csrf}, exp:session.expiresAt ?? 0 };
}
