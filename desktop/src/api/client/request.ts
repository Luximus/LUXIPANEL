import { ENV } from "../../config/env";
import { promptStepUp } from "../../lib/step-up-bridge";
import { emitRateLimited, parseRetryAfterSeconds } from "../../lib/rate-limit-notice";
import { refreshAccessToken } from "../auth-bridge";

export type ElectronRequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

export function getObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function getStringField(value: unknown, field: string): string | null {
  const obj = getObject(value);
  const fieldValue = obj?.[field];
  return typeof fieldValue === "string" ? fieldValue : null;
}

export async function request<T>(path: string, token: string, init?: RequestInit, _retriedScope?: string, _retriedAuth = false): Promise<T> {
  const url = `${ENV.apiUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(init?.headers ?? {}),
  } as Record<string, string>;

  // Gate 2FA: ante 403 STEP_UP_REQUIRED + scope, pide el código (cacheado por
  // scope ~5 min) y reintenta con el token. Centraliza el 2FA de todas las
  // acciones. Devuelve `undefined` si no se pudo reintentar (cancelado / sin 2FA).
  const retryWithStepUp = async (data: unknown): Promise<T | undefined> => {
    const scope = getStringField(data, "scope");
    if (!scope || _retriedScope === scope) return undefined;
    const stepUpToken = await promptStepUp(scope);
    if (!stepUpToken) return undefined;
    return request<T>(
      path,
      token,
      { ...init, headers: { ...(init?.headers ?? {}), "X-Step-Up-Token": stepUpToken } },
      scope,
      _retriedAuth,
    );
  };

  // Sesión expirada (access JWT vencido) → intenta renovar con el refresh token
  // (sin re-autenticar el proveedor) y reintenta UNA vez con el token nuevo.
  const retryWithRefresh = async (): Promise<T | undefined> => {
    if (_retriedAuth) return undefined;
    const fresh = await refreshAccessToken();
    if (!fresh) return undefined;
    return request<T>(path, fresh, init, _retriedScope, true);
  };

  if (window.electronApi?.request) {
    const result = (await window.electronApi.request({
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    })) as ElectronRequestResult;

    if (!result.ok) {
      if (result.status === 401) {
        const retried = await retryWithRefresh();
        if (retried !== undefined) return retried;
      }
      if (result.status === 403 && getStringField(result.data, "code") === "STEP_UP_REQUIRED") {
        const retried = await retryWithStepUp(result.data);
        if (retried !== undefined) return retried;
      }
      // 429: avisa al modal global (con el tiempo de reintento) y sigue lanzando
      // el error para que el llamador maneje el fallo como hasta ahora.
      if (result.status === 429) emitRateLimited(parseRetryAfterSeconds(result.data));
      const message = getStringField(result.data, "error") ?? `HTTP ${result.status}`;
      throw new Error(message);
    }

    return result.data as T;
  }

  const response = await fetch(url, { ...init, headers });
  const data: unknown = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      const retried = await retryWithRefresh();
      if (retried !== undefined) return retried;
    }
    if (response.status === 403 && getStringField(data, "code") === "STEP_UP_REQUIRED") {
      const retried = await retryWithStepUp(data);
      if (retried !== undefined) return retried;
    }
    if (response.status === 429) emitRateLimited(parseRetryAfterSeconds(data, response.headers.get("Retry-After")));
    throw new Error(getStringField(data, "error") ?? "Request failed");
  }
  return data as T;
}

/** Like `request` but preserves status + structured body on non-2xx so the
 *  caller can handle the 409 host-fingerprint (TOFU) approval flow. */
export async function requestRaw(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${ENV.apiUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    ...(init?.headers ?? {}),
  } as Record<string, string>;
  if (window.electronApi?.request) {
    const result = (await window.electronApi.request({
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    })) as ElectronRequestResult;
    const okFlag = result.ok && (result.data as { ok?: boolean })?.ok !== false;
    return { ok: okFlag, status: result.status, data: result.data };
  }
  const response = await fetch(url, { ...init, headers });
  const data: unknown = await response.json().catch(() => ({}));
  const okFlag = response.ok && (data as { ok?: boolean })?.ok !== false;
  return { ok: okFlag, status: response.status, data };
}
