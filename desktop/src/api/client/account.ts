// Cuenta del usuario: perfil, vistas admin de consumo/pagos, avatar,
// verificación WhatsApp y borrado de cuenta — extraído de client.ts.
import { ENV } from "../../config/env";
import { request } from "./request";

export type CurrentCustomer = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: "admin" | "user" | string;
  company?: string | null;
  country?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  locale?: string | null;
  photoUrl?: string | null;
  /** MB efectivos de subida permitidos para el rol (resuelto server-side,
   *  1–50). Aplica al avatar Y a los adjuntos de soporte. Fallback: 5. */
  maxUploadMb?: number | null;
};

export async function getCurrentCustomer(token: string): Promise<CurrentCustomer | null> {
  try {
    const data = await request<{ ok?: boolean; customer?: CurrentCustomer }>("/portal/me", token);
    return data?.customer ?? null;
  } catch {
    return null;
  }
}

// ─── Consumo de usuarios (vista admin) ────────────────────────────────────
export type AdminConsumptionRow = {
  customerId: string;
  name: string | null;
  email: string | null;
  data: { free: number; paid: number; total: number; consumedMb: number; availableMb: number };
  tokens: number;
  purchases: number;
  spentUsd: number;
};
export type AdminConsumptionTotals = {
  consumedMb: number; availableMb: number; spentUsd: number; tokens: number; purchases: number; users: number;
};

/** Consumo + compras de los usuarios NO admin. Solo responde a cuentas admin. */
export async function getAdminConsumption(
  token: string,
): Promise<{ rows: AdminConsumptionRow[]; totals: AdminConsumptionTotals }> {
  const data = await request<{ ok?: boolean; rows?: AdminConsumptionRow[]; totals?: AdminConsumptionTotals }>(
    "/portal/admin/consumption?page=1&limit=100",
    token,
  );
  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    totals: data.totals ?? { consumedMb: 0, availableMb: 0, spentUsd: 0, tokens: 0, purchases: 0, users: 0 },
  };
}

export type AdminPaymentRow = {
  id: string;
  reference: string;
  status: string;
  amountUsd: number | null;
  tier: string | null;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  productName: string | null;
};

/** Forma laxa del pago tal como llega del backend (se normaliza abajo). */
type RawAdminPayment = {
  id?: string | number;
  reference?: string | null;
  status?: string | null;
  amountUsd?: number | null;
  amount_usd?: number | null;
  tier?: string | null;
  createdAt?: string | null;
  customer?: { name?: string | null; email?: string | null } | null;
  product?: { name?: string | null } | null;
};

/** Pagos de TODOS los usuarios (solo admin). Normaliza la forma del backend. */
export async function getAdminPayments(token: string): Promise<AdminPaymentRow[]> {
  const data = await request<{ ok?: boolean; payments?: RawAdminPayment[] }>(
    "/portal/admin/payments?page=1&limit=500",
    token,
  );
  return (Array.isArray(data.payments) ? data.payments : []).map((p) => ({
    id: String(p.id),
    reference: String(p.reference ?? ""),
    status: String(p.status ?? ""),
    amountUsd: typeof p.amountUsd === "number" ? p.amountUsd : typeof p.amount_usd === "number" ? p.amount_usd : null,
    tier: p.tier ?? null,
    createdAt: String(p.createdAt ?? ""),
    customerName: p.customer?.name ?? null,
    customerEmail: p.customer?.email ?? null,
    productName: p.product?.name ?? null,
  }));
}

export async function updateCurrentCustomer(
  token: string,
  body: { name?: string; company?: string | null; country?: string | null; phoneCountryCode?: string | null; phone?: string | null; locale?: string },
): Promise<CurrentCustomer | null> {
  const data = await request<{ ok?: boolean; customer?: CurrentCustomer }>("/portal/me", token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data?.customer ?? null;
}

// ── Avatar / foto de perfil (subida directa a R2 vía backend) ─────────────
// Contrato (backend/src/modules/portal/portal.controller.ts → uploadAvatar):
//   POST   /portal/me/avatar  multipart campo `file` → { ok, data: { photoUrl } }
//   DELETE /portal/me/avatar                          → { ok, data: { photoUrl: null } }
// Replica el patrón de subida de adjuntos de soporte (multipart, campo `file`).
// `photoUrl` es una URL ABSOLUTA de R2 (no necesita prefijo de origen).

/** MIME aceptados por el backend para el avatar (espejo de AVATAR_ALLOWED_MIME). */
export const AVATAR_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
/** Tamaño máximo del avatar: 15 MB (espejo de AVATAR_MAX_BYTES). Holgado para GIF animado. */
export const AVATAR_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Sube/reemplaza la foto de perfil del usuario autenticado. Cada subida
 * reemplaza la anterior en R2 (key determinista por usuario en el backend).
 * Devuelve la `photoUrl` absoluta de R2.
 *
 * Usa XMLHttpRequest (no `fetch`) porque sólo XHR expone el progreso de subida
 * de bytes (`xhr.upload.onprogress`), necesario para la barra de carga. El
 * callback `onProgress` recibe 0–100; tras 100 el servidor aún procesa (sube a
 * R2) y la promesa resuelve al recibir la respuesta.
 */
export function uploadAvatar(file: File, token: string, onProgress?: (percent: number) => void): Promise<string> {
  const url = `${ENV.apiUrl}/portal/me/avatar`;
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file, file.name);

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

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
      let payload: { ok?: boolean; error?: string; data?: { photoUrl?: string } } | null = null;
      try { payload = JSON.parse(xhr.responseText); } catch { /* respuesta no-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.ok && payload.data?.photoUrl) {
        resolve(payload.data.photoUrl);
      } else if (xhr.status === 413) {
        reject(new Error(payload?.error ?? "La imagen supera el límite de subida permitido."));
      } else {
        reject(new Error(payload?.error ?? `HTTP ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Error de red al subir la imagen")));
    xhr.addEventListener("timeout", () => reject(new Error("La subida tardó demasiado. Revisa tu conexión e inténtalo de nuevo.")));
    xhr.addEventListener("abort", () => reject(new Error("Carga cancelada")));

    try {
      xhr.send(form);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Error al subir la imagen"));
    }
  });
}

/** Quita la foto de perfil (borra en R2 best-effort y pone photoUrl=null). */
export async function deleteAvatar(token: string): Promise<void> {
  const url = `${ENV.apiUrl}/portal/me/avatar`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  let payload: { ok?: boolean; error?: string } | null = null;
  try { payload = await res.json(); } catch { /* respuesta no-JSON */ }
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `HTTP ${res.status}`);
  }
}

// ── Verificación de teléfono por WhatsApp (OTP, estilo luxichat) ──────────
export async function startWhatsappVerification(token: string, phoneE164: string): Promise<{ wa_url: string; expires_at: string; sent: boolean }> {
  const data = await request<{ ok: boolean; data: { wa_url: string; expires_at: string; sent: boolean } }>(
    "/portal/whatsapp/verification/start", token,
    { method: "POST", body: JSON.stringify({ phone_e164: phoneE164 }) },
  );
  return data.data;
}

export async function verifyWhatsappCode(token: string, code: string): Promise<boolean> {
  const data = await request<{ ok: boolean; data: { verified: boolean } }>(
    "/portal/whatsapp/verification/verify", token,
    { method: "POST", body: JSON.stringify({ code }) },
  );
  return Boolean(data.data?.verified);
}

export async function getWhatsappStatus(token: string): Promise<{ whatsapp_verified: boolean; whatsapp_number: string | null }> {
  const data = await request<{ ok: boolean; data: { whatsapp_verified: boolean; whatsapp_number: string | null } }>(
    "/portal/whatsapp/verification/status", token,
  );
  return data.data;
}

/** Resultado del borrado de cuenta autoservicio. `deactivated` cuando la
 *  cuenta tenía compras y se conservó (desactivada) para auditoría. */
export type DeleteAccountResult = { ok: boolean; action: "deleted" | "deactivated" };

export async function deleteCurrentAccount(token: string): Promise<DeleteAccountResult> {
  const data = await request<{ ok?: boolean; data?: { action?: "deleted" | "deactivated" } }>(
    "/portal/me",
    token,
    { method: "DELETE" },
  );
  return { ok: Boolean(data?.ok), action: data?.data?.action === "deactivated" ? "deactivated" : "deleted" };
}
