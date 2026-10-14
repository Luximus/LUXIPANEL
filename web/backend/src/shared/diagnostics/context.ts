import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "../types/index.js";

export const diagnosticContext = new AsyncLocalStorage<() => { user?: SessionUser; requestId?: string; url?: string }>();
/** Diagnostics describe this installation's application, including failures
 * while serving remote/hosting sessions. Only its local administrators read it. */
export function diagnosticScope(_user?: SessionUser): string {
  return "instance";
}
