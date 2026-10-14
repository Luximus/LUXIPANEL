import type { SessionUser } from "./auth";
import { getBackendUrl } from "./server-env";

export type UiBootstrap = {
  version: number; user: SessionUser; targetId: string; layout: Record<string,string>;
  preferences: {theme: string;language: string|null}; modules: Array<Record<string,unknown>>;
  assistant: Record<string,unknown>|null;
};
const requests = new WeakMap<Request, Promise<UiBootstrap | null>>();
export function getUiBootstrap(request: Request): Promise<UiBootstrap|null> {
  let pending=requests.get(request);
  if (!pending) {
    pending=fetch(`${getBackendUrl()}/api/ui/bootstrap`, {headers:{cookie:request.headers.get("cookie")??"",
      host:request.headers.get("host")??"",...(request.headers.get("x-bridge-session-id")?{"X-Bridge-Session-Id":request.headers.get("x-bridge-session-id")!}:{})},
      signal:AbortSignal.timeout(8000)}).then(async response => {
        if (!response.ok) return null;
        const body=await response.json();return body.ok && body.data?.user ? body.data as UiBootstrap:null;
      }).catch(()=>null);
    requests.set(request,pending);
  }
  return pending;
}
