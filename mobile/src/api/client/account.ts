// Cuenta del usuario: /portal/me, avatar (R2), actualización de perfil y
// borrado de cuenta (gateado por Play Integrity).
import { ENV } from "../../config/env";
import { requestWithPlayIntegrity } from "../../integrity";
import {
  type ReadOptions,
  invalidateCurrentCustomer,
  readCache,
  request,
  TTL,
} from "./request";
import type { UploadFileInput } from "./support-tickets";

export type CurrentCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  country?: string | null;
  /** Prefijo telefónico (columna `phone_country_code`), p. ej. "+57". */
  phoneCountryCode?: string | null;
  /** Número local SIN prefijo (columna `phone`), p. ej. "3001234567". */
  phone?: string | null;
  locale?: string | null;
  photoUrl?: string | null;
  role?: "admin" | "user" | string;
  /** MB efectivos permitidos por subida (avatar + adjuntos de soporte),
   *  resueltos y acotados server-side por rol (rango 1–50). Fallback 5 si falta. */
  maxUploadMb?: number | null;
};

/**
 * `/portal/me`. Lo piden en el arranque, a la vez, el controller de CADA
 * pestaña, `MainScreen` (límite de subida), `AccountMenu` (flag admin) y el
 * modal de cuenta: sin caché eran 4+ peticiones idénticas por arranque. TTL 60s
 * + single-flight → una. Las mutaciones del perfil invalidan.
 */
export async function getCurrentCustomer(token: string, opts?: ReadOptions): Promise<CurrentCustomer | null> {
  try {
    // El fetcher LANZA ante un fallo para que el error NO se cachee (un fallo
    // transitorio no debe dejar `null` pegado 60s); el `catch` de aquí conserva
    // el contrato previo (`null` en vez de propagar).
    return await readCache.fetch(`me|${token}`, async () => {
      const data = await request<{ ok?: boolean; customer?: CurrentCustomer }>("/portal/me", token);
      return data?.customer ?? null;
    }, { ttlMs: TTL.me, force: opts?.force });
  } catch {
    return null;
  }
}

// ─── Avatar de perfil (Cloudflare R2 vía backend) ─────────────────────────
// Contrato (autoridad: backend modules/portal):
//   POST   /portal/me/avatar  → multipart, campo `file`
//           respuesta { ok:true, data:{ photoUrl } } (URL ABSOLUTA de R2)
//   DELETE /portal/me/avatar  → { ok:true, data:{ photoUrl: null } }
// Tipos aceptados: image/jpeg, image/png, image/webp, image/gif (GIF animado se
// conserva tal cual). El tamaño máximo es DINÁMICO por rol: el backend lo
// resuelve y acota server-side y lo entrega en `customer.maxUploadMb` (fallback
// 5 MB). El cliente valida contra ese valor antes de subir. Cada subida
// REEMPLAZA la anterior.
export const AVATAR_ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/**
 * Sube/reemplaza el avatar del usuario. Misma técnica que
 * `uploadTicketAttachment`: XHR + FormData con el objeto {uri,name,type} que RN
 * acepta como archivo. Devuelve el `photoUrl` ABSOLUTO de R2 (usable tal cual en
 * `<Image source={{ uri }} />`, sin prefijos).
 */
export function uploadAvatar(
  file: UploadFileInput,
  token: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const url = `${ENV.apiUrl}/portal/me/avatar`;
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    // RN acepta el patrón {uri,name,type} como archivo en FormData.
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-client-platform", "app");

    // Progreso de SUBIDA de bytes (0–100). Tras llegar a 100 el servidor aún
    // procesa/sube a R2; el `load` resuelve cuando termina (la UI mantiene el
    // estado "subiendo" en ese tramo final).
    if (onProgress) {
      xhr.upload.addEventListener("progress", (e: ProgressEvent) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
        }
      });
    }

    // Sin timeout, un corte del proxy (p.ej. 413 sin cuerpo) deja la barra
    // congelada para siempre. 2 min es holgado para 15 MB en redes lentas.
    xhr.timeout = 120_000;

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { ok?: boolean; data?: { photoUrl?: string }; error?: string };
          const photoUrl = data?.data?.photoUrl;
          if (data?.ok && typeof photoUrl === "string" && photoUrl.length > 0) {
            // XHR: no pasa por el funnel de `request` → invalida a mano.
            invalidateCurrentCustomer();
            resolve(photoUrl);
            return;
          }
          reject(new Error(data?.error ?? "Respuesta inválida del servidor"));
        } catch {
          reject(new Error("Respuesta inválida del servidor"));
        }
      } else if (xhr.status === 413) {
        // El límite es DINÁMICO por rol (server-side); no afirmamos un número fijo
        // aquí. El backend suele devolver el detalle exacto en `error`; si el
        // cuerpo es no-JSON (cortado por un proxy) usamos un texto sin cifra.
        let msg = "La imagen es demasiado grande.";
        try { msg = (JSON.parse(xhr.responseText) as { error?: string })?.error ?? msg; } catch { /* cuerpo no-JSON (proxy) */ }
        reject(new Error(msg));
      } else {
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(data?.error ?? `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Error de red al subir la imagen")));
    xhr.addEventListener("timeout", () => reject(new Error("La subida tardó demasiado. Revisa tu conexión e inténtalo de nuevo.")));
    xhr.addEventListener("abort", () => reject(new Error("Carga cancelada")));

    try {
      xhr.send(form as unknown as Document);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Error al subir la imagen"));
    }
  });
}

/** Quita la foto de perfil. Devuelve `null` (el backend pone photoUrl=null). */
export async function deleteAvatar(token: string): Promise<null> {
  await request<{ ok?: boolean; data?: { photoUrl?: null } }>("/portal/me/avatar", token, { method: "DELETE" });
  return null;
}

export async function updateCurrentCustomer(
  payload: {
    name?: string;
    company?: string | null;
    country?: string | null;
    phoneCountryCode?: string | null;
    phone?: string | null;
    locale?: string;
  },
  token: string,
): Promise<CurrentCustomer | null> {
  try {
    const data = await request<{ ok?: boolean; customer?: CurrentCustomer }>("/portal/me", token, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return data?.customer ?? null;
  } catch {
    return null;
  }
}

/** Resultado del borrado de cuenta autoservicio. `deactivated` cuando la
 *  cuenta tenía compras y se conservó (desactivada) para auditoría. */
export type DeleteAccountResult = { ok: boolean; action: "deleted" | "deactivated" };

export async function deleteCurrentAccount(token: string): Promise<DeleteAccountResult> {
  // Protected action: account.delete (DELETE /portal/me).
  // payloadRelevantForHash = {} — the request has no body; the identity comes
  // from the session token (excluded from the hash). The action name binds the
  // integrity token to "delete my account".
  const data = await requestWithPlayIntegrity<{
    ok?: boolean;
    data?: { action?: "deleted" | "deactivated" };
  }>({
    action: "account.delete",
    payloadRelevantForHash: {},
    run: (headers) =>
      request<{ ok?: boolean; data?: { action?: "deleted" | "deactivated" } }>(
        "/portal/me",
        token,
        { method: "DELETE", headers },
      ),
  });
  return { ok: Boolean(data?.ok), action: data?.data?.action === "deactivated" ? "deactivated" : "deleted" };
}
