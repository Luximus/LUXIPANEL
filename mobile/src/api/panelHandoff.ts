import { connectPanel } from "./client/panels";
import { redeemPanelHandoff, type DirectSession } from "./directAuth";

/** LP autentica usando la bóveda del propietario; después la app habla directo
 * al box. Ninguna contraseña o llave SSH se descarga al teléfono. */
export async function connectWithSavedPanelCredentials(
  panelId: string,
  portalToken: string,
  baseUrl: string,
  sshKeyId?: string | null,
  isCurrent: () => boolean = () => true,
): Promise<DirectSession | null> {
  if (!portalToken || !baseUrl || !isCurrent()) return null;
  try {
    const response = await connectPanel(panelId, portalToken, sshKeyId ? { sshKeyId } : undefined);
    if (!isCurrent()) return null;
    if (!response.ok || response.data?.authenticated !== true || !response.data.handoff) {
      console.warn("[panelConnect:v3] Saved credential handoff unavailable");
      return null;
    }
    const session = await redeemPanelHandoff(baseUrl, response.data.handoff, isCurrent);
    if (isCurrent()) console.info(`[panelConnect:v3] Native session ${session ? "captured" : "unavailable"}`);
    return session;
  } catch {
    if (isCurrent()) console.warn("[panelConnect:v3] Account connection request failed");
    return null;
  }
}
